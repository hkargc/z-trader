/*!
 * [Z交易系统] 
 * Z Trader System
 * 
 * @description 基于 AnyStock 的自动化/半自动化辅助交易工具
 * @copyright   Copyright (c) 2026 [hkargc at gmail dot com]
 * @license     PolyForm Noncommercial License 1.0.0 (仅限非商业用途)
 * @see         {@link https://github.com/hkargc/z-trader} 项目仓库
 * @see         {@link https://polyformproject.org} 协议详情
 * 
 * --------------------------------------------------------------------------
 * 第三方库声明 (Third-party Libraries):
 * --------------------------------------------------------------------------
 * 1. AnyStock (AnyChart)
 *    - 版权归 AnyChart 所有。
 *    - 其使用受 AnyChart 许可条款约束，商业用途需自行购买授权。
 *    - 详情访问: https://www.anychart.com
 * --------------------------------------------------------------------------
 */
"use strict";
const _this = self;
_this.importScripts("./long.min.js");
_this.importScripts("./protobuf.min.js");
_this.importScripts("./locutus.min.js");
_this.importScripts("./config.js?_=" + Math.random());
_this.importScripts("./config.proto.js");

_this.roots = new protobuf.Root(); //所有proto都挂载到这里来,避免重复下载
_this.roots.resolvePath = function(origin, target) {
    return "../proto/" + target;
};
_this.loads = {}; //缓存proto异步对象
_this.locks = {}; //同步锁
/**
 * https://github.com/google/closure-library/blob/master/closure/goog/crypt/crypt.js
 * @param {type} str
 * @returns {Array|Window.stringToUtf8ByteArray.out}
 */
_this.stringToUtf8ByteArray = function(str) {
	let out = [];
	let p = 0;
	for (let i = 0; i < str.length; i++) {
		let c = str.charCodeAt(i);
		if (c < 128) {
			out[p++] = c;
		} else if (c < 2048) {
			out[p++] = (c >> 6) | 192;
			out[p++] = (c & 63) | 128;
		} else if (
			((c & 0xFC00) == 0xD800) && (i + 1) < str.length && ((str.charCodeAt(i + 1) & 0xFC00) == 0xDC00)) {
			c = 0x10000 + ((c & 0x03FF) << 10) + (str.charCodeAt(++i) & 0x03FF);
			out[p++] = (c >> 18) | 240;
			out[p++] = ((c >> 12) & 63) | 128;
			out[p++] = ((c >> 6) & 63) | 128;
			out[p++] = (c & 63) | 128;
		} else {
			out[p++] = (c >> 12) | 224;
			out[p++] = ((c >> 6) & 63) | 128;
			out[p++] = (c & 63) | 128;
		}
	}
	return out;
};
/**
 * https://github.com/google/closure-library/blob/master/closure/goog/crypt/crypt.js
 * @param {type} bytes
 * @returns {String}
 */
_this.utf8ByteArrayToString = function(bytes) {
	let out = [];
	let pos = 0;
	let c = 0;
	while (pos < bytes.length) {
		let c1 = bytes[pos++];
		if (c1 < 128) {
			out[c++] = String.fromCharCode(c1);
		} else if (c1 > 191 && c1 < 224) {
			let c2 = bytes[pos++];
			out[c++] = String.fromCharCode((c1 & 31) << 6 | c2 & 63);
		} else if (c1 > 239 && c1 < 365) {
			let c2 = bytes[pos++];
			let c3 = bytes[pos++];
			let c4 = bytes[pos++];
			let u = ((c1 & 7) << 18 | (c2 & 63) << 12 | (c3 & 63) << 6 | c4 & 63) - 0x10000;
			out[c++] = String.fromCharCode(0xD800 + (u >> 10));
			out[c++] = String.fromCharCode(0xDC00 + (u & 1023));
		} else {
			let c2 = bytes[pos++];
			let c3 = bytes[pos++];
			out[c++] = String.fromCharCode((c1 & 15) << 12 | (c2 & 63) << 6 | c3 & 63);
		}
	}
	return out.join('');
};
_this.wss = {};
_this.wk = +_this.name;
_this.names = ['quote', 'trade'];
_this.call = function(data) {
	if (data.proto == -1001) { //初始化
		if (empty(config[_this.names[_this.name]][1]) || empty(config[_this.names[_this.name]][1]["websocketUri"])) {
			return _this.post({
				retMsg: _this.name + ' websocketUri error.'
			});
		}
		_this.wss = new WebSocket(config[_this.names[_this.name]][1]["websocketUri"]);
		_this.wss.binaryType = "arraybuffer";
		_this.wss.addEventListener('open', function(e) {
			_this.call({
				proto: 1,
				c2s: {
					//'IP': '', //OpenD地址
					//'Port': '', //OpenD端口
					//'RSAPrivateKey': '', //与OpenD连接的密钥正文
					'websocketKey': md5(config[_this.names[_this.name]][1]["websocketKey"]),
					'clientID': 'ft-v1.0',
					'programmingLanguage': 'JavaScript'
				},
				serialNo: data.serialNo
			});
		});
		_this.wss.addEventListener('message', function(e) {
			let m = {};
			let view = new DataView(e.data);
			m.sign = new Array();
			for (let i = 0; i <= 7; i++) {
				m.sign[i] = view.getUint8(i);
			}
			m.sign = _this.utf8ByteArrayToString(m.sign).replace(/\0/g, '');
			m.proto = view.getUint32(8, false); //确保是一个数字
			m.serialNo = view.getBigUint64(12, false);
			m.serialNo = Number(m.serialNo);
			m.error = view.getUint32(20, false);
			m.errmsg = new Array();
			for (let i = 0; i <= 19; i++) {
				m.errmsg[i] = view.getUint8(i + 24);
			}
			m.errmsg = _this.utf8ByteArrayToString(m.errmsg).replace(/\0/g, '');
			let buffer = new Uint8Array(e.data, 44);

			if (empty(_this.locks[m.proto])) { //确保它是Promise
				_this.locks[m.proto] = true;
				_this.loads[m.proto] = protobuf.load(`../proto/${config['proto'][m.proto]}.proto`, _this.roots);
			}
			_this.loads[m.proto].then(function(root) {
				let message = root.lookupType(`${config['proto'][m.proto]}.Response`);
				let response = message.decode(buffer).toJSON();
				if (m.proto == 1) {
					m.proto = 1001;
				}
				m.s2c = response.s2c;
				m.retMsg = response.retMsg;
				m.retType = response.retType;
				m.errCode = response.errCode;
				_this.post(m);

				empty(_this.wk) && in_array(m.proto, [1004, 3103]) && _this.post({ //行情连接要模拟后端推送消息[触发时辰变更及收盘提醒]
					proto: 1003,
					serialNo: 0,
					retMsg: '',
					retType: 0,
					errCode: 0,
					s2c: {
						type: -1,
						event: {
							eventType: -1,
							desc: json_encode({
								"news": [],
								"gaps": [],
								"events": [] //重大事件
							})
						}
					}
				});
			}).catch(function(e) {
				_this.post({
					retMsg: e.message
				});
				console.log(e);
				delete _this.locks[m.proto];
				delete _this.loads[m.proto];
			});
		});
		_this.wss.addEventListener('error', function(e) {
			_this.post({
				retMsg: _this.name + ' error.'
			});
		});
		_this.wss.addEventListener('close', function(e) {
			_this.post({
				retMsg: _this.name + ' close.'
			});
		});
	} else { //发送数据
		data.proto = +data.proto; //确保是一个数字
		if (empty(_this.locks[data.proto])) { //确保它是Promise
			_this.locks[data.proto] = true;
			_this.loads[data.proto] = protobuf.load(`../proto/${config['proto'][data.proto]}.proto`, _this.roots);
		}
		_this.loads[data.proto].then(function(root) {
			let request = root.lookupType(`${config['proto'][data.proto]}.Request`);
			let buffer = request.encode({
				'c2s': data.c2s
			}).finish();
			let buff = new ArrayBuffer(20 + buffer.byteLength);
			let view = new DataView(buff);
			let bytes = _this.stringToUtf8ByteArray("ft-v1.0");
			for (let i = 0; i < bytes.length; i++) {
				view.setUint8(i, bytes[i]);
			}
			for (let i = bytes.length; i <= 7; i++) {
				view.setUint8(i, 0);
			}
			view.setUint32(8, data.proto, false);
			view.setBigUint64(12, BigInt(data.serialNo), false); //BigInt有浏览器兼容性问题
			for (let i = 0; i < buffer.byteLength; i++) {
				view.setUint8(20 + i, buffer[i]);
			}
			if (_this.wss.readyState == WebSocket.OPEN) {
				return _this.wss.send(buff);
			}
			empty(_this.wss) || _this.post({
				retMsg: _this.name + ' readyState error.'
			});
		}).catch(function(e) {
			_this.post({
				retMsg: e.message
			});
			console.log(e);
			delete _this.locks[data.proto];
			delete _this.loads[data.proto];
		});
	}
};
_this.post = function(m) {
	_this.postMessage([array_replace_recursive({
		proto: 0,
		serialNo: 0,
		s2c: {
			wk: _this.wk
		},
		retMsg: _this.name + ' message error.',
		retType: -1,
		errCode: 0
	}, m), _this.name]);
};
_this.addEventListener('message', function(e) {
	_this.call(e.data);
}, false);