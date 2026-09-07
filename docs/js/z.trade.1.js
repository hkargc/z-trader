/*!
 * [Z交易系统] 
 * Z Trader System
 * 
 * @description 基于 AnyStock 的自动化/半自动化辅助交易工具
 * @copyright   Copyright (c) 2026 [hkargc at gmail dot com]
 * @license     PolyForm Noncommercial License 1.0.0 (仅限非商业用途)
 * @see         {@link https://github.com/hkargc/trader} 项目仓库
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
_this.importScripts("./futu.compiled.min.js");
_this.importScripts("./locutus.min.js");
_this.importScripts("./config.js?_=" + Math.random());
_this.protos = {
	1: 'InitWebSocket',
	1001: 'InitConnect', //初始化连接
	1002: 'GetGlobalState', //获取全局状态
	1003: 'Notify', //事件通知推送
	1004: 'KeepAlive', //保活心跳
	2001: 'Trd_GetAccList', //获取交易业务账户列表
	2005: 'Trd_UnlockTrade', //解锁或锁定交易
	2008: 'Trd_SubAccPush', //订阅业务账户的交易推送数据
	2101: 'Trd_GetFunds', //获取账户资金
	2102: 'Trd_GetPositionList', //获取账户持仓
	2111: 'Trd_GetMaxTrdQtys', //获取最大交易数量
	2112: 'Trd_GetComboMaxTrdQtys', //查询组合可交易信息
	2201: 'Trd_GetOrderList', //获取订单列表
	2202: 'Trd_PlaceOrder', //下单
	2205: 'Trd_ModifyOrder', //修改订单
	2208: 'Trd_UpdateOrder', //推送订单状态变动通知
	2211: 'Trd_GetOrderFillList', //获取成交列表
	2218: 'Trd_UpdateOrderFill', //推送成交通知
	2221: 'Trd_GetHistoryOrderList', //获取历史订单列表
	2222: 'Trd_GetHistoryOrderFillList', //获取历史成交列表
	2223: 'Trd_GetMarginRatio', //获取融资融券数据
	2225: 'Trd_GetOrderFee', //获取订单费用
	2226: 'Trd_FlowSummary', //查询账户资金流水
	2227: 'Trd_PlaceComboOrder', //组合下单
	3001: 'Qot_Sub', //订阅或者反订阅
	3003: 'Qot_GetSubInfo', //获取订阅信息
	3004: 'Qot_GetBasicQot', //获取股票基本报价
	3005: 'Qot_UpdateBasicQot', //推送股票基本报价
	3006: 'Qot_GetKL', //获取 K 线
	3007: 'Qot_UpdateKL', //推送 K 线
	3008: 'Qot_GetRT', //获取分时
	3009: 'Qot_UpdateRT', //推送分时
	3010: 'Qot_GetTicker', //获取逐笔
	3011: 'Qot_UpdateTicker', //推送逐笔
	3012: 'Qot_GetOrderBook', //获取买卖盘
	3013: 'Qot_UpdateOrderBook', //推送买卖盘
	3014: 'Qot_GetBroker', //获取经纪队列
	3015: 'Qot_UpdateBroker', //推送经纪队列
	3019: 'Qot_UpdatePriceReminder', //到价提醒通知
	3103: 'Qot_RequestHistoryKL', //在线获取单只股票一段历史 K 线
	3104: 'Qot_RequestHistoryKLQuota', //获取历史 K 线额度
	3105: 'Qot_RequestRehab', //在线获取单只股票复权信息
	3202: 'Qot_GetStaticInfo', //获取股票静态信息
	3203: 'Qot_GetSecuritySnapshot', //获取股票快照
	3204: 'Qot_GetPlateSet', //获取板块集合下的板块
	3205: 'Qot_GetPlateSecurity', //获取板块下的股票
	3206: 'Qot_GetReference', //获取正股相关股票
	3207: 'Qot_GetOwnerPlate', //获取股票所属板块
	3209: 'Qot_GetOptionChain', //获取期权链
	3210: 'Qot_GetWarrant', //获取窝轮
	3211: 'Qot_GetCapitalFlow', //获取资金流向
	3212: 'Qot_GetCapitalDistribution', //获取资金分布
	3213: 'Qot_GetUserSecurity', //获取自选股分组下的股票
	3214: 'Qot_ModifyUserSecurity', //修改自选股分组下的股票
	3215: 'Qot_StockFilter', //获取条件选股
	3217: 'Qot_GetIpoList', //获取新股
	3218: 'Qot_GetFutureInfo', //获取期货合约资料
	3219: 'Qot_RequestTradeDate', //获取市场交易日，在线拉取不在本地计算
	3220: 'Qot_SetPriceReminder', //设置到价提醒
	3221: 'Qot_GetPriceReminder', //获取到价提醒
	3222: 'Qot_GetUserSecurityGroup', //获取自选股分组列表
	3223: 'Qot_GetMarketState', //获取指定品种的市场状态
	3224: 'Qot_GetOptionExpirationDate', //获取期权到期日
	3225: 'Qot_GetFinancialsEarningsPriceMove', //获取财报日前后价格涨跌幅表现
	3226: 'Qot_GetFinancialsEarningsPriceHistory', //获取财报日前后股价历史
	3227: 'Qot_GetFinancialsStatements', //获取财务报表
	3228: 'Qot_GetFinancialsRevenueBreakdown', //获取主营构成
	3229: 'Qot_GetResearchAnalystConsensus', //获取分析师评级概述
	3230: 'Qot_GetResearchRatingSummary', //获取评级汇总
	3231: 'Qot_GetResearchMorningstarReport', //获取晨星研究报告
	3232: 'Qot_GetValuationDetail', //获取个股/指数估值详情
	3233: 'Qot_GetValuationPlateStockList', //获取板块/指数成分股估值列表
	3234: 'Qot_GetCorporateActionsDividends', //获取分红派息
	3235: 'Qot_GetCorporateActionsBuybacks', //获取回购
	3236: 'Qot_GetCorporateActionsStockSplits', //获取拆合股
	3237: 'Qot_GetShareholdersOverview', //获取持股统计
	3238: 'Qot_GetShareholdersHoldingChanges', //获取持股变动
	3239: 'Qot_GetShareholdersHolderDetail', //获取持股明细
	3240: 'Qot_GetShareholdersInstitutional', //获取机构持股
	3241: 'Qot_GetInsiderHolderList', //获取内部人持股列表
	3242: 'Qot_GetInsiderTradeList', //获取内部人交易
	3243: 'Qot_GetCompanyProfile', //获取公司概况
	3244: 'Qot_GetCompanyExecutives', //获取高管信息
	3245: 'Qot_GetCompanyExecutiveBackground', //获取高管背景
	3246: 'Qot_GetCompanyOperationalEfficiency', //获取经营效率
	3247: 'Qot_GetTopTenBuySellBrokers', //获取十大经纪商买卖数据
	3248: 'Qot_GetDailyShortVolume', //获取每日卖空成交
	3249: 'Qot_GetShortInterest', //获取空头持仓
	3250: 'Qot_GetOptionVolatility', //获取期权波动率分析
	3251: 'Qot_GetOptionExerciseProbability' //获取期权行权概率
};
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
_this.call = function(data) {
	if (data.proto == -1001) { //初始化
		if(empty(config.trade[1]) || empty(config.trade[1]["websocketUri"])){
			return _this.post({
				retMsg: _this.name + ' websocketUri error.'
			});
		}
		_this.wss = new WebSocket(config.trade[1]["websocketUri"]);
		_this.wss.binaryType = "arraybuffer";
		_this.wss.addEventListener('open', function(e) {
			_this.call({
				proto: 1,
				c2s: {
					//'IP': '', //OpenD地址
					//'Port': '', //OpenD端口
					//'RSAPrivateKey': '', //与OpenD连接的密钥正文
					'websocketKey': md5(config.trade[1]["websocketKey"]),
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
			m.proto = view.getUint32(8, false);
			m.serialNo = view.getBigUint64(12, false);
			m.serialNo = Number(m.serialNo);
			m.error = view.getUint32(20, false);
			m.errmsg = new Array();
			for (let i = 0; i <= 19; i++) {
				m.errmsg[i] = view.getUint8(i + 24);
			}
			m.errmsg = _this.utf8ByteArrayToString(m.errmsg).replace(/\0/g, '');
			let buffer = new Uint8Array(e.data, 44);
			let response = _this['protos'][m.proto] ? protobuf.roots.default[_this['protos'][m.proto]]['Response'].decode(buffer) : {
				s2c: {},
				retType: 0,
				retMsg: m.errmsg,
				errCode: m.error
			};
			if (m.proto == 1) {
				m.proto = 1001;
			}
			m.s2c = response.s2c;
			m.retMsg = response.retMsg;
			m.retType = response.retType;
			m.errCode = response.errCode;
			_this.post(m);
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
		let request = protobuf.roots.default[_this['protos'][data.proto]]['Request'];
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
	}
};
_this.post = function(m) {
	_this.postMessage([array_replace_recursive({
		proto: 0,
		serialNo: 0,
		s2c: {
			wk: 1
		},
		retMsg: _this.name + ' message error.',
		retType: -1,
		errCode: 0
	}, m), _this.name]);
};
_this.addEventListener('message', function(e) {
	_this.call(e.data);
}, false);