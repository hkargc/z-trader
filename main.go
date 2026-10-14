/*
 * 项目名称：Z-Trader
 * 文件名称：main.go
 * 代码生成：Gemini (AI 助手)
 * 创建日期：2026年9月1日
 *
 * 功能说明：
 *   本代码文件由 Gemini 辅助生成与优化。
 *   作为 Z-Trader 系统的主入口文件，负责程序的初始化与核心逻辑调度。
 *
 * 版权声明：
 *   Copyright (c) 2026 Z-Trader. 保留所有权利。
 */
 
package main

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/url"
	"os"
	"path"
	"path/filepath"
	"strings"
	"sync"
	"syscall"
	"time"
	"unsafe"

	"github.com/coder/websocket"
)

// --- 全局常量配置 ---
const (
	ListenAddr = "127.0.0.1:10086"             // 本地监听地址与端口
	DllPath    = "./libs/WinDataCollect64.dll" // 目标 DLL 文件路径
	StaticDir  = "./docs"                    // 静态网页资源存放目录
)

var (
	// 【Windows DLL 加载】
	// syscall.NewLazyDLL 延迟加载 DLL，只有在真正调用 Proc 时才尝试打开文件
	dll = syscall.NewLazyDLL(DllPath)
	// 获取 DLL 内部导出的函数：CTP_GetSystemInfo
	getSysInfoFn = dll.NewProc("?CTP_GetSystemInfo@@YAHPEADAEAH@Z")
)

func getSystemInfo() (string, string) {

	// 1. 获取 MAC 地址 (增加物理网卡过滤)
	macAddr := "00:00:00:00:00:00"
	interfaces, err := net.Interfaces()
	if err != nil {
		fmt.Printf("[DEBUG] Net interfaces error: %v\n", err)
	}

	for _, inter := range interfaces {
		// 过滤：需启用、非虚拟回环、且有硬件地址
		if (inter.Flags&net.FlagUp != 0) && (inter.Flags&net.FlagLoopback == 0) && inter.HardwareAddr != nil {
			macAddr = inter.HardwareAddr.String()
			fmt.Printf("[DEBUG] Found active MAC: %s (Interface: %s)\n", macAddr, inter.Name)
			break
		}
	}

	// 2. 准备 DLL 缓冲区 (使用 512 字节具备更好的兼容性)
	buf := make([]byte, 512)
	length := int32(len(buf))

	// 获取底层数据的真实内存地址
	// 使用 &buf[0] 明确传递 C 函数需要的 char* 指针首地址
	pBuf := uintptr(unsafe.Pointer(&buf[0]))
	pLen := uintptr(unsafe.Pointer(&length))

	// 3. 执行 DLL 调用
	ret, _, _ := getSysInfoFn.Call(pBuf, pLen)

	sysInfo := ""
	if ret == 0 {
		// 检查 DLL 写回的实际长度
		if length > 0 && int(length) <= len(buf) {
			// 严格根据 DLL 返回的长度截取实际写入的字节
			rawData := buf[:length]

			// 如果末尾包含 C 风格的结束符 \x00，进行裁剪
			if rawData[len(rawData)-1] == 0 {
				rawData = rawData[:len(rawData)-1]
			}

			// 进行 Base64 编码
			sysInfo = base64.StdEncoding.EncodeToString(rawData)

			// 打印部分结果用于验证
			preview := sysInfo
			if len(preview) > 30 {
				preview = preview[:30] + "..."
			}
			fmt.Printf("[DEBUG] Encoded SysInfo: %s\n", preview)
		} else {
			fmt.Printf("[DEBUG] Warning: DLL returned invalid length: %d\n", length)
		}
	} else {
		fmt.Printf("[DEBUG] DLL logic failed with ret: %d\n", ret)
	}

	return macAddr, sysInfo
}

// 【协议定义】
// ProxyRequest 对应你提供的 PHP 逻辑中 POST 提交的 JSON 结构体
type ProxyRequest struct {
	Act     string            `json:"act"`     // 指令动作，如 "GetSystemInfo"
	Method  string            `json:"method"`  // 中转目标的方法：GET 或 POST
	Uri     string            `json:"uri"`     // 中转的目标 URL 地址
	Headers map[string]string `json:"headers"` // 需要透传给目标的 HTTP Header
	Data    interface{}       `json:"data"`    // 需要发送的数据载体
	JSON    bool              `json:"json"`    // 是否以 JSON 格式发送数据
}

func handleWebSocket(w http.ResponseWriter, r *http.Request) {
	// 1. 升级连接 (Accept)
	c, err := websocket.Accept(w, r, &websocket.AcceptOptions{
		InsecureSkipVerify: true,
	})
	if err != nil {
		fmt.Printf("[WS ERROR] Accept failed: %v\n", err)
		return
	}
	defer c.Close(websocket.StatusNormalClosure, "handler exit")

	ctx, cancel := context.WithCancel(r.Context())
	defer cancel()

	var (
		targetConn *websocket.Conn
		muClient   sync.Mutex
		muRemote   sync.Mutex
	)

	// 2. 消息循环 (Client -> Server)
	for {
		mType, message, err := c.Read(ctx)
		if err != nil {
			break
		}

		var msg map[string]interface{}
		if err := json.Unmarshal(message, &msg); err != nil {
			continue
		}

		// 3. 识别特定握手协议 (proto 1001)
		if proto, ok := msg["proto"].(float64); ok && int(proto) == 1001 {
			if targetConn != nil {
				targetConn.Close(websocket.StatusNormalClosure, "re-handshake")
				targetConn = nil
			}

			c2s, _ := msg["c2s"].(map[string]interface{})
			targetUri, _ := c2s["uri"].(string)

			// 构造拨号参数
			dialOptions := &websocket.DialOptions{
				HTTPHeader:      make(http.Header),
				CompressionMode: websocket.CompressionContextTakeover,
			}

			// 复制原始 Headers
			if h, ok := c2s["headers"].(map[string]interface{}); ok {
				for k, v := range h {
					dialOptions.HTTPHeader.Set(k, fmt.Sprintf("%v", v))
				}
			}

			// 修正 Origin
			if dialOptions.HTTPHeader.Get("Origin") == "" {
				if u, err := url.Parse(targetUri); err == nil {
					schema := "http"
					if u.Scheme == "wss" {
						schema = "https"
					}
					dialOptions.HTTPHeader.Set("Origin", fmt.Sprintf("%s://%s", schema, u.Host))
				}
			}

			fmt.Printf("[DEBUG] Dialing Target: %s\n", targetUri)

			// 4. 拨号到目标服务器
			tc, _, err := websocket.Dial(ctx, targetUri, dialOptions)
			if err != nil {
				fmt.Printf("[WS ERROR] Dial remote failed: %v\n", err)
				continue
			}
			tc.SetReadLimit(8 << 20)
			targetConn = tc

			// 5. 启动反向转发协程 (Remote -> Client)
			go func(remote *websocket.Conn) {
				defer cancel()
				defer remote.Close(websocket.StatusNormalClosure, "remote gone")

				for {
					tType, p, err := remote.Read(ctx)
					if err != nil {
						return
					}
					muClient.Lock()
					err = c.Write(ctx, tType, p)
					muClient.Unlock()
					if err != nil {
						return
					}
				}
			}(targetConn)
			continue
		}

		// 6. 普通消息转发 (Client -> Remote)
		if targetConn != nil {
			muRemote.Lock()
			err := targetConn.Write(ctx, mType, message)
			muRemote.Unlock()
			if err != nil {
				fmt.Printf("[WS ERROR] Forward to remote failed: %v\n", err)
			}
		}
	}
}

// 提前定义全局 HttpClient 开启连接池复用
var httpClient = &http.Client{
	Timeout: 30 * time.Second,
}

// 【主路由处理器】
func mainHandler(w http.ResponseWriter, r *http.Request) {

	// 1. 如果请求包含 Upgrade: websocket，则进入 WebSocket 代理逻辑
	if strings.ToLower(r.Header.Get("Upgrade")) == "websocket" {
		handleWebSocket(w, r)
		return
	}

	// 2. 处理 POST 请求 (代理中转与 DLL 指令)
	if r.Method == http.MethodPost {
		// 读取客户端上传的 JSON 体
		body, _ := io.ReadAll(r.Body)
		var proxyReq ProxyRequest
		if err := json.Unmarshal(body, &proxyReq); err != nil {
			fmt.Printf("[DEBUG] JSON Unmarshal Error: %v | Body: %s\n", err, string(body))
			http.Error(w, "Invalid JSON string", 400)
			return
		}

		// 【特殊分支】调用 DLL 获取系统信息
		if proxyReq.Act == "GetSystemInfo" {
			mac, info := getSystemInfo()
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(map[string]string{
				"client_mac_address": mac,
				"client_system_info": info,
			})
			return
		}

		// 【核心代理中转逻辑】
		fmt.Printf("[DEBUG] Proxying POST -> Target: %s [%s]\n", proxyReq.Uri, proxyReq.Method)
		httpClient := &http.Client{}
		var reqBody io.Reader
		targetMethod := strings.ToUpper(proxyReq.Method)
		targetUri := proxyReq.Uri

		if proxyReq.Headers == nil {
			proxyReq.Headers = make(map[string]string)
		}

		// 注入 PHP 逻辑中必须包含的 gzip 压缩头
		proxyReq.Headers["Accept-Encoding"] = "gzip"

		// 【参数处理逻辑】
		if targetMethod == "GET" && proxyReq.Data != nil {
			u, err := url.Parse(targetUri)
			if err == nil {
				query := u.Query()
				if dataMap, ok := proxyReq.Data.(map[string]interface{}); ok {
					for k, v := range dataMap {
						query.Set(k, fmt.Sprintf("%v", v))
					}
				}
				u.RawQuery = query.Encode()
				targetUri = u.String()
			}
		} else if proxyReq.JSON {
			proxyReq.Headers["Content-Type"] = "application/json"
			jb, _ := json.Marshal(proxyReq.Data)
			reqBody = strings.NewReader(string(jb))
		} else if proxyReq.Data != nil {
			values := url.Values{}
			if dataMap, ok := proxyReq.Data.(map[string]interface{}); ok {
				for k, v := range dataMap {
					values.Set(k, fmt.Sprintf("%v", v))
				}
				reqBody = strings.NewReader(values.Encode())
				if _, ok := proxyReq.Headers["Content-Type"]; !ok {
					proxyReq.Headers["Content-Type"] = "application/x-www-form-urlencoded"
				}
			}
		}

		// 构造并执行外发请求
		tReq, _ := http.NewRequest(targetMethod, targetUri, reqBody)
		for k, v := range proxyReq.Headers {
			tReq.Header.Set(k, v)
		}

		resp, err := httpClient.Do(tReq)
		if err != nil {
			fmt.Printf("[DEBUG] Proxy Request Failed: %v\n", err)
			http.Error(w, err.Error(), 502)
			return
		}
		defer resp.Body.Close()

		// 复制 Header 和状态码
		for k, v := range resp.Header {
			w.Header()[k] = v
		}
		w.WriteHeader(resp.StatusCode)
		io.Copy(w, resp.Body)
		return
	}

	// 3. 处理 GET 请求 (静态文件服务器)
	if r.Method == http.MethodGet {
		cleanPath := path.Clean(r.URL.Path)
		if strings.Contains(cleanPath, "com.chrome.devtools.json") {
			http.NotFound(w, r)
			return
		}
		fPath := filepath.Join(StaticDir, cleanPath)

		info, err := os.Stat(fPath)
		if err != nil {
			fmt.Printf("[DEBUG] File Not Found: %s\n", fPath)
			http.NotFound(w, r)
			return
		}
		if info.IsDir() {
			fPath = filepath.Join(fPath, "index.html")
			info, err = os.Stat(fPath)
			if err != nil {
				fmt.Printf("[DEBUG] File Not Found: %s\n", fPath)
				http.NotFound(w, r)
				return
			}
		}

		http.ServeFile(w, r, fPath)
		return
	}
}

func init() {
	syscall.MustLoadDLL("kernel32.dll").MustFindProc("SetConsoleTitleW").Call(
		uintptr(unsafe.Pointer(syscall.StringToUTF16Ptr("Z-Trader Proxy"))),
	)
}

func main() {
	fmt.Println("===================================================")
	fmt.Println("         Z-Trader Proxy (Go Windows版)         ")
	fmt.Println("===================================================")
	fmt.Printf("\n[运行中] 监听地址: http://%s\n", ListenAddr)
	fmt.Println("\n>>> 正在进行底层兼容性连接测试...")
	fmt.Println("\n[注意] 本窗口为后台服务程序，请勿关闭！")
	fmt.Println("===================================================")

	http.HandleFunc("/", mainHandler)

	err := http.ListenAndServe(ListenAddr, nil)
	if err != nil {
		fmt.Printf("\n[错误] 端口被占用或启动失败: %v\n", err)
		fmt.Println("按回车键退出程序...")
		fmt.Scanln()
	}
}
