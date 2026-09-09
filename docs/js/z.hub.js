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
/**
 * 维护2个Worker线程:行情服务+交易服务;
 */
function ZHub() {
	/**
	 * 
	 * @type ZHub
	 */
	const _this = this;
	/**
	 * 仿真交易需要
	 */
	this.uid = 1;
	/**
	 * 行情来源:根据此值加载不同的行情Worker线程 0无;1富途的websocket服务;11天勤的websocket行情;
	 */
	this.quote = 0;
	/**
	 * 交易入口:根据此值加载不同的交易Worker线程 0无;1富途的websocket服务;11天勤的websocket交易;92自建前端仿真;
	 */
	this.trade = 0;
	/**
	 * 前端仿真成交模式trading mode:0无;1以实时报价进行成交[成交量不受控,只要价格到了就成交];2以买买盘和逐笔进行成交[最接近实战,但要求实时摆盘和实时逐笔];
	 */
	this.tmode = 0;
	/**
	 * 交易环境:0仿真交易;1实盘交易[含天勤,simnow交易];
	 */
	this.trdEnv = 0;
	/**
	 * 行情市场:1香港市场11美国市场20天勤市场[自创]21沪股市场22深股市场31新加坡市场41日本市场51澳大利亚市场61马来西亚市场71加拿大市场81外汇市场
	 */
	this.qotMarket = 1;
	/**
	 * 交易市场:1香港[证券,期权]2美国[证券,期权]3大陆市场[模拟]4A股通5期货6新加坡8澳洲10香港期货模拟11美国期货模拟12新加坡期货模拟13日本期货模拟15日本市场111马来西亚112加拿大113香港基金123美国基金
	 */
	this.trdMarket = 1;
	/**
	 * 交易证券市场[仅下单处] 1香港市场（股票、窝轮、牛熊、期权、期货等）;2美国市场（股票、期权、期货等）;31沪股市场（股票）;32深股市场（股票）;41新加坡市场（期货）;51日本市场（期货）61澳大利亚;71马来西亚;81加拿大;91外汇101大陆期货[自创]
	 */
	this.secMarket = 1;
	/**
	 * 交易日市场calendar[仅交易日接口] 1香港市场（含股票、ETFs、窝轮、牛熊、期权、非假期交易期货；不含假期交易期货）2美国市场（含股票、ETFs、期权；不含期货）3A股市场4深（沪）股通5港股通（深、沪）6日本期货7新加坡期货
	 */
	this.calMarket = 1;
	/**
	 * 账户所属券商:在获取交易账号处需要 0富途/自建模拟;1:富途证券(香港);2:moomoo证券(美国);3:moomoo证券(新加坡);4:moomoo证券(澳大利亚);101:天勤接口[自创]
	 */
	this.securityFirm = 0;
	/**
	 * 交易连接ID,用于防重放攻击
	 */
	this.connID = 0;
	/**
	 * 
	 */
	this.accList = [];
	/**
	 * 单位秒
	 */
	this.keepAliveInterval = 10;
	/**
	 * 保持连接定时器
	 */
	this.Timer = 0;
	/**
	 * 递增的包序列
	 */
	this.serialNo = 0;
	/**
	 * 各线程
	 */
	this.wk = [];
	/**
	 * 用于限频
	 */
	this.qq = [];
	/**
	 * 各线程最后一次收包时间
	 */
	this.up = [];
	/**
	 * 响应函数队列[与serialNo强绑定]
	 */
	this.cb = [];
	/**
	 * 标的列表
	 */
	this.stocks = {};
	/**
	 * 默认响应函数
	 * @param {type} args
	 * @returns {undefined}
	 */
	this.callback = function(...args) {
		console.log(args);
	};
	/**
	 * 下标固定,对应此类的两个属性:行情quote和交易trade
	 */
	this.names = ['quote', 'trade'];
	/**
	 * 逐步创建WebSocket连接[浏览器不支持同时创建多个]
	 */
	this.start = function() {
		if (_this.Timer) { //已经完成所有连接的创建
			return true;
		}
		for (let n = 0; n <= 1; n++) { //确保顺序执行
			if (empty(_this[_this.names[n]])) { //不需要该链接...
				continue;
			}
			if (isset(_this.wk[n])) { //已经初始化了
				continue;
			}
			_this.wk[n] = new Worker('./js/z.' + _this.names[n] + '.' + _this[_this.names[n]] + '.js?_=' + Math.random(), {
				name: n
			});
			_this.wk[n].addEventListener('error', function(e) {
				_this.callback({
					proto: 0,
					serialNo: 0,
					s2c: {
						wk: n
					},
					retMsg: `协议:1001@线程:${n}无法初始化.`,
					retType: -1,
					errCode: 0
				}, n);
			});
			_this.wk[n].addEventListener('message', function(e) {
				let m = e.data[0];
				let n = e.data[1];
				if (empty(_this.up[n])) { //此连接已响应,接着初始化下一个
					_this.start();
				}
				_this.up[n] = window.performance.now();
				if (_this.cb[m.serialNo] && (_this.cb[m.serialNo].proto == m.proto) && (m.retType >= 0)) { //强绑定的回调
					_this.cb[m.serialNo].cb(m, n);
				} else {
					_this.callback(m, n);
				}
				delete _this.cb[m.serialNo];
			}, false);
			return _this.send(-1001, {
				uid: _this.uid,
				quote: _this.quote,
				trade: _this.trade,
				tmode: _this.tmode
			}, n); //此处的return确保了每次只初始化一个
		}
		_this.Timer = window.setInterval(function() { //整十秒执行
			if ((new Date()).getSeconds() % _this.keepAliveInterval) {
				return true;
			}
			let now = window.performance.now();
			for (let n in _this.wk) {
				n = intval(n);
				if (empty(_this.up[n])) { //初始化未完成
					continue;
				}
				if (in_array(_this[_this.names[n]], [1])) { //该范围内的无需PING
					continue;
				}
				if ((now - _this.up[n]) <= _this.keepAliveInterval * 2000) { //网络正常
					_this.send(1004, {
						time: parseInt((Date.now()) / 1000)
					}, n);
				} else {
					_this.callback({
						proto: 0,
						serialNo: 0,
						s2c: {
							wk: n
						},
						retMsg: `协议:1004@线程:${n}连通失败.`,
						retType: -1,
						errCode: 0
					}, n);
				}
			}
		}, 1 * 1000);
	};
	/**
	 * 根据quote/trade指示,把数据发送至对应线程
	 * @param {type} proto 协议号,每个协议号对应一个proto文档,严格对应富途接口
	 * @param {type} c2s proto中c2s的部分
	 * @param {type} n 要发送到哪个线程: 0行情1交易
	 * @param {type} cb 异步响应函数,与serialNo绑定
	 * @returns 
	 */
	this.send = function(proto, c2s, n, cb) {
		if (arguments.length < 3) {
			return false;
		}
		let off = false; //是否超出了限频(仅针对当前页面)
		if (in_array(proto, [2202]) && !_this.limit(proto, 30, 15, 0.02 * 10)) { //下单(30秒15次,间隔0.02秒) 这里设置为0.2秒:5次/秒
			off = true;
		}
		if (in_array(proto, [2205]) && !_this.limit(proto, 30, 20, 0.04 * 5)) { //改单(30秒20次,间隔0.04秒)
			off = true;
		}
		if (off) {
			window.setTimeout(_this.send, 100, proto, c2s, n, cb, true);
			false && arguments[4] && _this.callback({
				proto: 0,
				serialNo: 0,
				s2c: {
					wk: n
				},
				retMsg: `协议:${proto}@线程:${n}超出限频.`,
				retType: -2,
				errCode: 0
			}, n);
			return 0;
		}
		let m = {
			proto: proto,
			c2s: c2s,
			serialNo: ++_this.serialNo
		};
		if (typeof(cb) === 'function') {
			_this.cb[m.serialNo] = {
				proto: proto,
				cb: cb
			};
		}
		if (!isset(_this.wk[n])) { //没有初始化该线程
			return _this.callback({
				proto: 0,
				serialNo: 0,
				s2c: {
					wk: n
				},
				retMsg: `协议:${proto}@线程:${n}没有初始化.`,
				retType: -2,
				errCode: 0
			}, n);
		}
		_this.wk[n].postMessage(m);
		return m.serialNo;
	};
	/**
	 * 限频:一个环形结构
	 * @param {type} proto
	 * @param {type} sec 比如30秒
	 * @param {type} cnt 比如20次
	 * @param {type} delay 比如两次间隔0.02秒
	 * @returns {Boolean}
	 */
	this.limit = function(proto, sec, cnt, delay) {
		let ago;
		sec *= 1000;
		delay *= 1000;
		let now = window.performance.now();
		if (empty(_this.qq[proto])) {
			_this.qq[proto] = [];
		}
		while (ago = intval(array_shift(_this.qq[proto]))) {
			if (now - ago <= sec) {
				array_unshift(_this.qq[proto], ago);
				break;
			}
		}
		let length = count(_this.qq[proto]);
		if (length >= cnt) {
			return false;
		}
		if (length && delay && (now - _this.qq[proto][length - 1] <= delay)) {
			return false;
		}
		return array_push(_this.qq[proto], now) <= cnt ? true : false;
	};
	/**
	 * 获取交易账号:在富途交易中必须配置正确
	 * @param {type} trdMarket 交易市场
	 * @returns {undefined}
	 */
	this.accID = function(trdMarket) {
		let accIDList = [];
		let simAccType = 0; //模拟交易账号类型 0非模拟账户 1股票模拟账户（仅用于交易证券类产品，不支持交易期权）2期权模拟账户（仅用于交易期权，不支持交易股票证券类产品）3期货模拟账户
		if (empty(_this.trdEnv)) { //模拟交易
			simAccType = 1; //默认股票模拟,不支持期权模拟
			if (in_array(trdMarket, [10, 11, 12, 13])) { //期货模拟
				simAccType = 3;
			}
		}
		for (let i in _this.accList) {
			let a = _this.accList[i];
			if (a['accStatus']) {
				continue;
			}
			if (intval(a['securityFirm']) != _this.securityFirm) {
				continue;
			}
			if (intval(a['trdEnv']) != _this.trdEnv) {
				continue;
			}
			if (!in_array(trdMarket, a['trdMarketAuthList'])) {
				continue;
			}
			if (intval(a['simAccType']) != simAccType) {
				continue;
			}
			if (empty(a['accID'])) {
				continue;
			}
			accIDList.push(l2s(a['accID']));
		}
		if (empty(accIDList)) {
			return 0;
		}
		return array_shift(accIDList);
	};
	/**
	 * 获取各市场开市休市状态
	 * @param {type} cb
	 * @returns {Number|undefined|Boolean|m.serialNo}
	 */
	this.GetGlobalState = function(cb) {
		let c2s = {
			'userID': 1 //历史原因,目前已废弃
		};
		return _this.send(1002, c2s, 0, cb);
	};
	/**
	 * 获取指定品种的市场状态
	 * @param {type} codes
	 * @param {type} cb
	 * @returns {Number|undefined|m.serialNo|Boolean}
	 */
	this.Qot_GetMarketState = function(codes, cb) {
		let securityList = [];
		is_array(codes) && codes.forEach(function(code, k, a) {
			securityList.push({
				'market': _this.qotMarket,
				'code': code
			});
		});
		if (empty(securityList)) {
			return false;
		}
		let c2s = {
			'securityList': securityList
		};
		return _this.send(3223, c2s, 0, cb);
	};
	/**
	 * 
	 * @param {type} secType
	 * @param {type} codes
	 * @param {type} cb
	 * @returns {Number|undefined|Boolean|m.serialNo}
	 */
	this.Qot_GetStaticInfo = function(secType, codes, cb) {
		let securityList = [];
		is_array(codes) && codes.forEach(function(code, k, a) {
			securityList.push({
				'market': _this.qotMarket,
				'code': code
			});
		});
		let c2s = {};
		if (securityList.length) {
			c2s = {
				'securityList': securityList
			};
		} else {
			c2s = {
				'market': _this.qotMarket,
				'secType': secType
			};
		}
		return _this.send(3202, c2s, 0, cb);
	};
	/**
	 * 
	 * @param {type} codes
	 * @param {type} cb
	 * @returns {Number|undefined|Boolean|m.serialNo}
	 */
	this.Qot_GetSecuritySnapshot = function(codes, securityList, cb) {
		empty(securityList) && is_array(codes) && codes.forEach(function(code, k, a) {
			securityList.push({
				'market': _this.qotMarket,
				'code': code
			});
		});
		let c2s = {
			'securityList': securityList
		};
		return _this.send(3203, c2s, 0, cb);
	};
	/**
	 * 
	 * @param {type} code
	 * @param {type} klType
	 * @param {type} beginTime
	 * @param {type} endTime
	 * @param {type} maxAckKLNum
	 * @param {type} nextReqKey
	 * @param {type} needKLFieldsFlag
	 * @param {type} rehabType
	 * @param {type} extendedTime
	 * @param {type} cb
	 * @returns {Number|undefined|Boolean|m.serialNo}
	 */
	this.Qot_RequestHistoryKL = function(code, klType, beginTime, endTime, maxAckKLNum, nextReqKey, needKLFieldsFlag, rehabType, extendedTime, cb) {
		let c2s = {
			'security': {
				'market': _this.qotMarket,
				'code': code
			},
			'klType': klType,
			'beginTime': date("Y-m-d H:i:s", beginTime),
			'endTime': date("Y-m-d H:i:s", endTime),
			'rehabType': rehabType
		};
		if (maxAckKLNum) {
			c2s['maxAckKLNum'] = maxAckKLNum;
		}
		if (nextReqKey) {
			c2s['nextReqKey'] = nextReqKey;
		}
		if (is_array(needKLFieldsFlag) && needKLFieldsFlag.length) {
			c2s['needKLFieldsFlag'] = needKLFieldsFlag;
		}
		if (extendedTime) {
			c2s['extendedTime'] = extendedTime;
		}
		return _this.send(3103, c2s, 0, cb);
	};
	/**
	 * 
	 * @param {type} beginTime
	 * @param {type} endTime
	 * @param {type} cb
	 * @returns {Number|undefined|Boolean|m.serialNo}
	 */
	this.Qot_RequestTradeDate = function(beginTime, endTime, cb) {
		let c2s = {
			'market': _this.calMarket,
			'beginTime': date('Y-m-d', beginTime), //开始时间字符串
			'endTime': date('Y-m-d', endTime) //结束时间字符串
		};
		return _this.send(3219, c2s, 0, cb);
	};
	/**
	 * 
	 * @param {type} codes
	 * @param {type} subTypeList 1报价;2摆盘;4逐笔;5分时;6日K;7五分K;8十五分K;9三十K;10六十K;11一分K;12周K;13月K;14经纪队列;15季K;16年K;17三分K;
	 * @param {type} isSubOrUnSub
	 * @param {type} isRegOrUnRegPush
	 * @param {type} regPushRehabTypeList
	 * @param {type} isFirstPush
	 * @param {type} isUnsubAll
	 * @param {type} isSubOrderBookDetail
	 * @param {type} extendedTime
	 * @param {type} cb
	 * @returns {Boolean}
	 */
	this.Qot_Sub = function(codes, subTypeList, isSubOrUnSub, isRegOrUnRegPush, regPushRehabTypeList, isFirstPush, isUnsubAll, isSubOrderBookDetail, extendedTime, cb) {
		if (arguments.length < 5) {
			return false;
		}
		let securityList = [];
		codes.forEach(function(code, k, a) {
			securityList.push({
				'market': _this.qotMarket,
				'code': code
			});
		});
		_this.send(3001, {
			'securityList': securityList,
			'subTypeList': subTypeList,
			'isSubOrUnSub': isSubOrUnSub,
			'isRegOrUnRegPush': isRegOrUnRegPush,
			'regPushRehabTypeList': regPushRehabTypeList,
			'isFirstPush': isFirstPush,
			'isUnsubAll': isUnsubAll,
			'isSubOrderBookDetail': isSubOrderBookDetail,
			'extendedTime': extendedTime
		}, 0, cb);
	};
	/**
	 * 
	 * @param {type} code
	 * @param {type} klType
	 * @param {type} reqNum
	 * @param {type} rehabType
	 * @param {type} cb
	 * @returns {Number|undefined|m.serialNo|Boolean}
	 */
	this.Qot_GetKL = function(code, klType, reqNum, rehabType, cb) {
		if (arguments.length < 4) {
			return false;
		}
		let c2s = {
			'security': {
				'market': _this.qotMarket,
				'code': code
			},
			'klType': klType,
			'reqNum': reqNum,
			'rehabType': rehabType
		};
		return _this.send(3006, c2s, 0, cb);
	};
	/**
	 * 
	 * @param {type} code
	 * @param {type} filter
	 * @param {type} begin
	 * @param {type} num
	 * @param {type} sortField
	 * @param {type} ascend
	 * @param {type} cb
	 * @returns {Number|undefined|m.serialNo|Boolean}
	 */
	this.Qot_GetWarrant = function(code, filter, begin, num, sortField, ascend, cb) {
		if (arguments.length < 6) {
			return false;
		}
		let c2s = {
			'begin': begin,
			'num': num,
			'sortField': sortField,
			'ascend': ascend
		};
		if (code) {
			c2s['owner'] = {
				'market': _this.qotMarket,
				'code': code
			};
		}
		for (let k in filter) {
			c2s[k] = filter[k];
		}
		return _this.send(3210, c2s, 0, cb);
	};
	/**
	 * 
	 * @param {type} codes
	 * @param {type} bogus 是否伪造数据流,以便前端继续走流程
	 * @returns {Number|undefined|Boolean|m.serialNo}
	 */
	this.Qot_GetFutureInfo = function(codes, bogus) {
		if (bogus) {
			return _this.callback({
				proto: 3218,
				s2c: {
					futureInfoList: {}
				}
			}, 0);
		}
		let securityList = [];
		codes.forEach(function(code, k, a) {
			securityList.push({
				'market': _this.qotMarket,
				'code': code
			});
		});
		let c2s = {
			'securityList': securityList
		};
		return _this.send(3218, c2s, 0);
	};
	/**
	 * 解锁交易(30秒10次) 模拟交易不需要解锁
	 * @param {type} unlock
	 * @returns {Number|undefined|Boolean|m.serialNo}
	 */
	this.Trd_UnlockTrade = function(unlock) {
		return _this.send(2005, {
			'unlock': unlock ? true : true, //proto不支持false
			'pwdMD5': config.trade[_this.trade] ? md5(config.trade[_this.trade]['pwd']) : '',
			'securityFirm': _this.securityFirm
		}, 1);
	};
	/**
	 * 获取交易业务账户列表
	 * @returns {Number|undefined|Boolean|m.serialNo}
	 */
	this.Trd_GetAccList = function() {
		if (empty(_this.trade)) { //无需交易的标的
			return _this.callback({
				proto: 2001,
				s2c: {
					accList: {}
				}
			}, 1);
		}
		return _this.send(2001, {
			'userID': 1, //历史原因,目前已废弃
			'trdCategory': 0, //交易品类:1证券2期货
			'needGeneralSecAccount': true //是否返回综合账户
		}, 1);
	};
	/**
	 * 
	 * @param {type} trdMarket
	 * @param {type} refreshCache
	 * @param {type} cb
	 * @returns {Number|undefined|Boolean|m.serialNo}
	 */
	this.Trd_GetFunds = function(trdMarket, refreshCache, cb) {
		let c2s = {
			'header': {
				'trdEnv': _this.trdEnv,
				'trdMarket': trdMarket,
				'accID': _this.accID(trdMarket)
			},
			'currency': 1,
			'refreshCache': refreshCache
		};
		return _this.send(2101, c2s, 1, cb);
	};
	/**
	 * 订阅交易推送
	 * @param {type} TrdMarkets
	 * @returns {Boolean}
	 */
	this.Trd_SubAccPush = function(TrdMarkets) {
		if (arguments.length !== 1) {
			return false;
		}
		if (empty(_this.trade)) { //无需交易的标的
			return _this.callback({
				proto: 2008,
				s2c: {}
			}, 1);
		}
		let accIDList = [];
		TrdMarkets.forEach(function(trdMarket, k, a) {
			let accID = _this.accID(trdMarket);
			accID && accIDList.push(accID);
		});
		_this.send(2008, {
			'accIDList': accIDList
		}, 1);
	};
	/**
	 * 查询未完成订单
	 * @param {type} trdMarket
	 * @param {type} refreshCache
	 * @returns {Number|undefined|m.serialNo|Boolean}
	 */
	this.Trd_GetOrderList = function(trdMarket, refreshCache) {
		if (arguments.length !== 2) {
			return false;
		}
		if (empty(_this.trade)) { //无需交易的标的
			return _this.callback({
				proto: 2201,
				s2c: {
					orderList: {}
				}
			}, 1);
		}
		trdMarket = trdMarket || _this.trdMarket;
		return _this.send(2201, {
			'header': {
				'trdEnv': _this.trdEnv,
				'trdMarket': trdMarket,
				'accID': _this.accID(trdMarket)
			},
			'filterStatusList': [0, 1, 2, 5, 10, 22, 11, 14],
			'refreshCache': refreshCache
		}, 1);
	};
	/**
	 * 查询当日成交
	 * @param {type} trdMarket
	 * @param {type} refreshCache
	 * @returns {Number|undefined|m.serialNo|Boolean}
	 */
	this.Trd_GetOrderFillList = function(trdMarket, refreshCache) {
		if (arguments.length !== 2) {
			return false;
		}
		if (empty(_this.trade) || (empty(_this.trdEnv) && in_array(_this.trade, [1, 2]))) { //无需交易的标的.走的是富途官方模拟交易,不支持成交数据
			return _this.callback({
				proto: 2211,
				s2c: {
					orderFillList: {}
				}
			}, 1);
		}
		trdMarket = trdMarket || _this.trdMarket;
		return _this.send(2211, { //查询当日成交
			'header': {
				'trdEnv': _this.trdEnv,
				'trdMarket': trdMarket,
				'accID': _this.accID(trdMarket)
			},
			//'filterConditions': {
			//	'codeList': []
			//},
			'refreshCache': refreshCache
		}, 1);
	};
	/**
	 * 查询历史成交,不支持富途模拟交易
	 * @param {type} beginTime
	 * @param {type} endTime
	 * @param {type} codeList
	 * @param {type} idList
	 * @param {type} trdMarket
	 * @returns {Number|undefined|Boolean|m.serialNo}
	 */
	this.Trd_GetHistoryOrderFillList = function(beginTime, endTime, codeList, idList, trdMarket) {
		if (empty(_this.trdEnv) && in_array(_this.trade, [1, 2])) { //走的是富途官方模拟交易,不支持成交数据
			return _this.callback({
				proto: 2222,
				s2c: {
					orderFillList: {}
				}
			}, 1);
		}
		trdMarket = trdMarket || _this.trdMarket;
		let c2s = {
			'header': {
				'trdEnv': _this.trdEnv,
				'trdMarket': trdMarket,
				'accID': _this.accID(trdMarket)
			},
			'filterConditions': {
				'beginTime': date('Y-m-d H:i:s', beginTime),
				'endTime': date('Y-m-d H:i:s', endTime)
			}
		};
		if (codeList.length) {
			c2s['filterConditions']['codeList'] = codeList;
		}
		if (idList.length) {
			c2s['filterConditions']['idList'] = idList;
		}
		return _this.send(2222, c2s, 1);
	};
	/**
	 * 查询持仓
	 * @param {type} trdMarket
	 * @param {type} refreshCache
	 * @returns {Number|undefined|m.serialNo|Boolean}
	 */
	this.Trd_GetPositionList = function(trdMarket, refreshCache) {
		if (arguments.length !== 2) {
			return false;
		}
		if (empty(_this.trade)) { //无需交易的标的
			return _this.callback({
				proto: 2102,
				s2c: {
					positionList: {}
				}
			}, 1);
		}
		trdMarket = trdMarket || _this.trdMarket;
		return _this.send(2102, {
			'header': {
				'trdEnv': _this.trdEnv,
				'trdMarket': trdMarket,
				'accID': _this.accID(trdMarket)
			},
			//'filterConditions': {
			//	'codeList': []
			//},
			'refreshCache': refreshCache
		}, 1);
	};
	/**
	 * 改单撤单
	 * @param {type} orderIDEx
	 * @param {type} modifyOrderOp 1改单(价格/数量)2撤单3失效4生效5删除
	 * @param {type} code 无法更改,只是为了下真实单
	 * @param {type} trdSide 无法更改,只是为了下真实单
	 * @param {type} qty
	 * @param {type} price
	 * @param {type} remark 无法更改,只是为了下真实单
	 * @returns {Number|undefined|m.serialNo|Boolean}
	 */
	this.Trd_ModifyOrder = function(orderIDEx, modifyOrderOp, code, trdSide, qty, price, remark) {
		if (arguments.length !== 7) {
			return false;
		}
		orderIDEx = trim(orderIDEx);
		modifyOrderOp = intval(modifyOrderOp);
		code = trim(code);
		trdSide = intval(trdSide);
		qty = intval(qty);
		price = price * 1;
		remark = '' + remark;
		if (!in_array(modifyOrderOp, [1, 2, 3, 4])) {
			return false;
		}
		if (!in_array(trdSide, [1, 2, 3, 4])) {
			return false;
		}
		if (qty <= 0) {
			return false;
		}
		if (price <= 0) {
			return false;
		}
		let o = _this.stock(code, {
			part: true
		});
		if (empty(o)) { //无此标的,需要完整的信息
			return false;
		}
		let c2s = {
			'header': {
				'trdEnv': _this.trdEnv,
				'trdMarket': o.trdMarket,
				'accID': _this.accID(o.trdMarket)
			},
			'packetID': {
				'connID': _this.connID,
				'serialNo': ++_this.serialNo
			},
			'orderID': 1, //忽略此值
			'orderIDEx': orderIDEx,
			'modifyOrderOp': modifyOrderOp
		};
		if (in_array(modifyOrderOp, [1])) { //改价格或数量
			c2s.qty = qty;
			c2s.price = price;
		}
		if (in_array(modifyOrderOp, [2])) { //富途支持撤单所有,为了兼容忽略
			c2s.forAll = false;
		}
		function_exists("buttons") && buttons(false); //锁住按钮,直到在持仓响应接口解锁
		if (strpos(orderIDEx, 'BOGUS_') === 0) { //如果是一个仿制品,改价格或数量无需调用后端,改为生效状态则...
			if (in_array(modifyOrderOp, [4])) { //生效要下一个真实单,同时把仿制品删除
				_this.Trd_PlaceOrder(code, trdSide, qty, price, remark, true);
			}
			return _this.callback({
				proto: 2208,
				s2c: {
					order: {
						orderIDEx: orderIDEx,
						price: price,
						qty: qty,
						remark: remark,
						code: code,
						orderStatus: in_array(modifyOrderOp, [2, 4]) ? 15 : 22,
						trdSide: trdSide,
						fillQty: 0,
						fillAvgPrice: 0,
						lastErrMsg: null,
						createTimestamp: time(),
						updateTimestamp: time()
					}
				}
			}, 1);
		} else if (in_array(modifyOrderOp, [3])) { //真实单改为失效:撤掉真实单,生成假单
			c2s.modifyOrderOp = 2;
			_this.Trd_PlaceOrder(code, trdSide, qty, price, remark, false);
		}
		return _this.send(2205, c2s, 1);
	};
	/**
	 * 下单
	 * @param {type} code
	 * @param {type} trdSide
	 * @param {type} qty
	 * @param {type} price
	 * @param {type} remark 利用这个字段放成本价
	 * @param {type} force 是否强制下一个真实的单.否则为失效单
	 * @returns {Number|undefined|m.serialNo|Boolean}
	 */
	this.Trd_PlaceOrder = function(code, trdSide, qty, price, remark, force) {
		if (arguments.length != 6) {
			return false;
		}
		code = trim(code);
		trdSide = intval(trdSide);
		qty = intval(qty);
		price = price * 1;
		remark = '' + remark;
		force = boolval(force);
		if (!in_array(trdSide, [1, 2, 3, 4])) {
			return false;
		}
		if (qty <= 0) {
			return false;
		}
		if (price <= 0) {
			return false;
		}
		let o = _this.stock(code, {
			part: true
		});
		if (empty(o)) { //无此标的,需要完整的信息
			return false;
		}
		function_exists("buttons") && buttons(false); //锁住按钮,直到在持仓响应接口解锁
		if (empty(force)) { //下一个失效单,不需要调后端.刷新页面这些单就消失了
			return _this.callback({
				proto: 2208,
				s2c: {
					order: {
						orderIDEx: 'BOGUS_' + md5(mt_rand()),
						price: price,
						qty: qty,
						remark: remark,
						code: code,
						orderStatus: 22,
						trdSide: trdSide,
						fillQty: 0,
						fillAvgPrice: 0,
						lastErrMsg: null,
						createTimestamp: time(),
						updateTimestamp: time()
					}
				}
			}, 1);
		}
		if (in_array(_this.trade, [1, 2]) && in_array(trdSide, [3])) { //富途接口
			trdSide = 2;
		}
		if (in_array(_this.trade, [1, 2]) && in_array(trdSide, [4])) {
			trdSide = 1;
		}
		return _this.send(2202, {
			'header': {
				'trdEnv': _this.trdEnv,
				'trdMarket': o.trdMarket,
				'accID': _this.accID(o.trdMarket)
			},
			'packetID': {
				'connID': _this.connID,
				'serialNo': ++_this.serialNo
			},
			'code': code,
			'trdSide': trdSide,
			'orderType': 1,
			'qty': qty,
			'price': price,
			'secMarket': o.secMarket,
			'timeInForce': 0,
			'remark': remark,
			'o': Object.assign({}, o)
		}, 1);
	};
	/**
	 * 获取某个标的信息
	 * @param {type} code
	 * @param {type} o {trdEnv:0,part:false,force:false} part 是否允许只返回静态部分 force 是否强制调用服务器
	 * @returns {}
	 */
	this.stock = function(code, o) {
		o = Object.assign({}, o);
		if (empty(_this.stocks[code])) {
			let _o = _this._stock({
				code: code,
				trdEnv: o.trdEnv || _this.trdEnv
			});
			_o['props'] = _this.props(_o['main_code']); //根据code计算出来的main_code是明确的
			_this.stocks[code] = _o;
		};
		if (_this.stocks[code]['qotType'] == _this.stocks[code]['secType']) { //已经是完整的信息
			return _this.stocks[code];
		}
		if (_this.stocks[code]["quote"] == _this.quote) { //与主角走同一条行情线路
			o.force && _this.Timer && _this.Qot_GetStaticInfo(0, [code]);
		}
		return o.part ? _this.stocks[code] : {};
	};
	/**
	 * 根据code和trdEnv计算该标的常规属性
	 * @param {type} o {code:'', trdEnv: 0}
	 * @returns {}
	 */
	this._stock = function(o) {
		o = array_merge({
			type: 0, //3牛证4熊证
			props: {}, //个性化设置
			lotSize: 1, //每手数量,下单处要用到
			contractSize: 1, //合约乘数
			minVar: 0, //最小变动价位,港股正股由当前价位通过算法得到,期货由3218接口得到
			curPrice: 0, //最新价,在K线中计算
			ownPrice: 0, //对应owner_code的最新价,街货图用到
			lastClosePrice: 0, //昨收价,在K线中计算
			lower_limit: 0, //跌停板
			upper_limit: 0,
			qotType: 0, //标志信息完整度
			secType: 0, //3正股6指数5窝轮10期货
			code: o.code, //标的代码.当前支持富途和天勤标准.区分大小写.利用code订阅行情,origin_code下单,owner_code订单打点用
			name: o.code, //标的中文名称
			trdEnv: o.trdEnv || _this.trdEnv, //交易环境:0仿真交易;1实盘交易;
			main_code: o.code, //主连合约代码,比如小恒指期货主连为 MHImain,定制yGrid的时候要用到
			owner_code: o.code, //成交打点处需要,比如 小恒指期货,恒指期货,恒指窝轮 的 owner_code 均为 800000,成交打点以此为据
			origin_code: o.code, //实际合约代码.下单处以此为准.期货则需要页面传递或通过接口获取主连合约
			quote: _this.quote,
			trade: _this.trade,
			tmode: _this.tmode,
			qotMarket: _this.qotMarket,
			trdMarket: _this.trdMarket,
			secMarket: _this.secMarket,
			calMarket: _this.calMarket,
			securityFirm: _this.securityFirm
		}, o);
		if (preg_match(/^800\d{3}$/, o.code)) { //800开头6位数字为港股指数
			o.secType = 6;
			o.minVar = 1;
			o.quote = 1; //1富途的websocket服务;
			o.trade = 0; //指数是不支持交易的
			return o;
		}
		if (preg_match(/^[A-Z]+$/, o.code)) { //全部大写字母:美股[少数几个带点号的不管了],其他市场比如新加坡也是如此,这里做不到区分的
			o.secType = 3;
			o.qotMarket = 11; //11美国市场
			o.trdMarket = 2; //2美国市场
			o.secMarket = 2; //2美国市场（股票、期权、期货等）
			o.calMarket = 2; //2美国市场（含股票、ETFs、期权；不含期货）
			o.securityFirm = o.trdEnv ? 1 : 0; //0富途/自建模拟;1:富途证券(香港);2:moomoo证券(美国);
			o.quote = 1; //1富途的websocket服务; 美股行情需付费[未调试]
			o.trade = o.trdEnv ? 1 : 92; //0与行情共用连接1富途的websocket服务;92自建前端仿真;[未调试]
			o.tmode = o.trdEnv ? 0 : 2; //美股行情需付费[未调试]
			return o;
		}
		if (preg_match(/^\d{5}$/, o.code)) { //纯5位数字为港股正股或涡轮 (證券代號編配計劃) https://www.hkex.com.hk/Global/Exchange/Sitemap?sc_lang=zh-HK
			o.qotMarket = 1; //1香港市场
			o.trdMarket = 1; //1香港市场
			o.secMarket = 1; //1香港市场（股票、窝轮、牛熊、期权、期货等）
			o.calMarket = 1; //1香港市场（含股票、ETFs、窝轮、牛熊、期权、非假期交易期货；不含假期交易期货）
			o.securityFirm = o.trdEnv ? 1 : 0; //0富途/自建模拟;1:富途证券(香港);2:moomoo证券(美国);
			o.quote = 1; //1富途的websocket服务;
			o.trade = o.trdEnv ? 1 : 92; //0无;1富途的websocket服务;92自建前端仿真;
			o.tmode = o.trdEnv ? 0 : 2; //富途推送完善的逐笔和十档摆盘
			let c = intval(o.code);
			if ((c >= 1) && (c <= 9999)) { //主板及 GEM 上市證券
				if ((c >= 1) && (c <= 2799)) { //主板證券
					o.secType = 3;
				} else if ((c >= 2800) && (c <= 2849)) { //交易所買賣基金
				} else if ((c >= 2850) && (c <= 2899)) { //主板證券
					o.secType = 3;
				} else if ((c >= 2900) && (c <= 2999)) { //主板臨時櫃台
				} else if ((c >= 3000) && (c <= 3199)) { //交易所買賣基金
				} else if ((c >= 3200) && (c <= 3399)) { //主板證券
					o.secType = 3;
				} else if ((c >= 3400) && (c <= 3599)) { //交易所買賣基金
				} else if ((c >= 3600) && (c <= 3999)) { //主板證券
					o.secType = 3;
				} else if ((c >= 4000) && (c <= 4199)) { //香港金融管理局的外匯基金債券
				} else if ((c >= 4200) && (c <= 4299)) { //香港特別行政區政府債券
				} else if ((c >= 4300) && (c <= 4329)) { //僅售予專業投資者的債務證券
				} else if ((c >= 4330) && (c <= 4399)) { //NASDAQ-AMEX 試驗計劃
				} else if ((c >= 4400) && (c <= 4599)) { //僅售予專業投資者的債務證券
				} else if ((c >= 4600) && (c <= 4699)) { //僅售予專業投資者優先股
				} else if ((c >= 4700) && (c <= 4799)) { //售予公眾的債務證券
				} else if ((c >= 4800) && (c <= 4999)) { //SPAC 權證
				} else if ((c >= 5000) && (c <= 6029)) { //僅售予專業投資者的債務證券
				} else if ((c >= 6030) && (c <= 6199)) { //主板證券
					o.secType = 3;
				} else if ((c >= 6200) && (c <= 6299)) { //香港預託證券
				} else if ((c >= 6300) && (c <= 6399)) { //被美國聯邦證券法界定為受限制(RS)證券的證券 / 預託證券
				} else if ((c >= 6400) && (c <= 6599)) { //供日後使用
				} else if ((c >= 6600) && (c <= 6749)) { //主板證券
					o.secType = 3;
				} else if ((c >= 6750) && (c <= 6799)) { //中華人民共和國財政部債券
				} else if ((c >= 6800) && (c <= 6999)) { //主板證券
					o.secType = 3;
				} else if ((c >= 7000) && (c <= 7199)) { //供日後使用
				} else if ((c >= 7200) && (c <= 7399)) { //槓桿及反向產品
				} else if ((c >= 7400) && (c <= 7499)) { //主板證券
					o.secType = 3;
				} else if ((c >= 7500) && (c <= 7599)) { //槓桿及反向產品
				} else if ((c >= 7600) && (c <= 7699)) { //主板證券
					o.secType = 3;
				} else if ((c >= 7700) && (c <= 7799)) { //槓桿及反向產品
				} else if ((c >= 7800) && (c <= 7999)) { //SPAC 股份
				} else if ((c >= 8000) && (c <= 8550)) { //GEM 證券
					o.secType = 3;
				} else if ((c >= 8551) && (c <= 8600)) { //GEM 臨時櫃台
				} else if ((c >= 8601) && (c <= 8999)) { //GEM 證券
					o.secType = 3;
				} else if ((c >= 9000) && (c <= 9199)) { //交易所買賣基金(以美元買賣)
				} else if ((c >= 9200) && (c <= 9399)) { //槓桿及反向產品(以美元買賣)
				} else if ((c >= 9400) && (c <= 9499)) { //交易所買賣基金(以美元買賣)
				} else if ((c >= 9500) && (c <= 9599)) { //槓桿及反向產品(以美元買賣)
				} else if ((c >= 9600) && (c <= 9699)) { //主板證券
					o.secType = 3;
				} else if ((c >= 9700) && (c <= 9799)) { //槓桿及反向產品(以美元買賣)
				} else if ((c >= 9800) && (c <= 9849)) { //交易所買賣基金(以美元買賣)
				} else if ((c >= 9850) && (c <= 9999)) { //主板證券
					o.secType = 3;
				}
			} else if ((c >= 10000) && (c <= 29999)) { //衍生權證
				if ((c >= 10000) && (c <= 10899)) { //相關資產在香港以外地區上市的衍生權證、一籃子權證及非標準型
				} else if ((c >= 10900) && (c <= 10999)) { //相關資產在香港以外地區上市的衍生權證(以美元買賣)
				} else if ((c >= 11000) && (c <= 11999)) { //相關資產在香港以外地區上市的衍生權證、一籃子權證及非標準型
				} else if ((c >= 12000) && (c <= 29999)) { //衍生權證
				}
			} else if ((c >= 30000) && (c <= 39999)) { //供滬深股通使用
			} else if ((c >= 40000) && (c <= 40999)) { //僅售予專業投資者的債務證券
			} else if ((c >= 41000) && (c <= 41499)) { //供日後使用
			} else if ((c >= 41500) && (c <= 41599)) { //交易所買賣基金(以美元買賣)
			} else if ((c >= 41600) && (c <= 46999)) { //供日後使用
			} else if ((c >= 47000) && (c <= 48999)) { //界內證
			} else if ((c >= 49000) && (c <= 49499)) { //供日後使用
			} else if ((c >= 49500) && (c <= 69999)) { //牛熊證
				if ((c >= 49500) && (c <= 49999)) { //相關資產在香港以外地區上市的牛熊證
				} else if ((c >= 50000) && (c <= 69999)) { //牛熊證
					o.secType = 5;
				}
			} else if ((c >= 70000) && (c <= 79999)) { //供滬深股通使用
			} else if ((c >= 80000) && (c <= 89999)) { //以人民幣買賣的產品
				if ((c >= 80000) && (c <= 82799)) { //主板證券
				} else if ((c >= 82800) && (c <= 82849)) { //交易所買賣基金
				} else if ((c >= 82850) && (c <= 82899)) { //主板證券
				} else if ((c >= 82900) && (c <= 82999)) { //主板臨時櫃台
				} else if ((c >= 83000) && (c <= 83199)) { //交易所買賣基金
				} else if ((c >= 83200) && (c <= 83399)) { //主板證券
				} else if ((c >= 83400) && (c <= 83599)) { //交易所買賣基金
				} else if ((c >= 83600) && (c <= 83999)) { //主板證券
				} else if ((c >= 84000) && (c <= 84299)) { //供日後使用
				} else if ((c >= 84300) && (c <= 84329)) { //僅售予專業投資者的債務證券
				} else if ((c >= 84330) && (c <= 84399)) { //供日後使用
				} else if ((c >= 84400) && (c <= 84599)) { //僅售予專業投資者的債務證券
				} else if ((c >= 84600) && (c <= 84699)) { //僅售予專業投資者優先股
				} else if ((c >= 84700) && (c <= 84999)) { //供日後使用
				} else if ((c >= 85000) && (c <= 85743)) { //僅售予專業投資者的債務證券
				} else if ((c >= 85744) && (c <= 85900)) { //售予公眾的債務證券
				} else if ((c >= 85901) && (c <= 86029)) { //僅售予專業投資者的債務證券
				} else if ((c >= 86030) && (c <= 86199)) { //主板證券
				} else if ((c >= 86200) && (c <= 86299)) { //供日後使用
				} else if ((c >= 86300) && (c <= 86399)) { //被美國聯邦證券法界定為受限制(RS)證券的證券 / 預託證券
				} else if ((c >= 86400) && (c <= 86599)) { //供日後使用
				} else if ((c >= 86600) && (c <= 86799)) { //中華人民共和國財政部債券 / 主板證券
				} else if ((c >= 86800) && (c <= 86999)) { //主板證券
				} else if ((c >= 87000) && (c <= 87099)) { //房地產投資信託基金及交易所買賣基金以外的單位信託 / 互惠基金
				} else if ((c >= 87100) && (c <= 87199)) { //供日後使用
				} else if ((c >= 87200) && (c <= 87399)) { //槓桿及反向產品
				} else if ((c >= 87400) && (c <= 87499)) { //主板證券
				} else if ((c >= 87500) && (c <= 87599)) { //槓桿及反向產品
				} else if ((c >= 87600) && (c <= 87699)) { //主板證券
				} else if ((c >= 87700) && (c <= 87799)) { //槓桿及反向產品
				} else if ((c >= 87800) && (c <= 88999)) { //供日後使用
				} else if ((c >= 89000) && (c <= 89099)) { //中華人民共和國財政部債券
				} else if ((c >= 89100) && (c <= 89199)) { //供日後使用
				} else if ((c >= 89200) && (c <= 89599)) { //衍生權證
				} else if ((c >= 89600) && (c <= 89699)) { //主板證券
				} else if ((c >= 89700) && (c <= 89849)) { //供日後使用
				} else if ((c >= 89850) && (c <= 89999)) { //主板證券
				}
			} else if ((c >= 90000) && (c <= 99999)) { //供滬深股通使用
			}
			return o;
		}
		if (preg_match(/^\d{6}$/, o.code)) { //纯6位数字为沪深
			o.secType = 3;
			o.minVar = 0.01; //大陆正股每档是固定的
			if (preg_match(/^(600|601|603|605)/, o.code)) { //沪市主板
				o.qotMarket = 21; //21沪股市场22深股市场
				o.secMarket = 31; //31沪股市场（股票）;32深股市场（股票）
			}
			if (preg_match(/^(688)/, o.code)) { //沪市科创板
				o.qotMarket = 21;
				o.secMarket = 31;
			}
			if (preg_match(/^(000|001|002|003)/, o.code)) { //深市主板
				o.qotMarket = 22;
				o.secMarket = 32;
			}
			if (preg_match(/^(300|301)/, o.code)) { //深市‌创业板
				o.qotMarket = 22;
				o.secMarket = 32;
			}
			o.trdMarket = 3; //3大陆市场
			o.calMarket = 3; //3A股市场
			o.securityFirm = o.trdEnv ? 101 : 0; //天勤支持A股交易[未调试]
			o.quote = 1; //A股从富途获取实时行情[天勤也是支持的][未调试]
			o.trade = o.trdEnv ? 11 : 92; //11天勤的websocket交易;92自建前端仿真;[未调试]
			o.tmode = o.trdEnv ? 0 : 2; //天勤应该有简单的盘口及逐笔行情[未调试]
			return o;
		}
		let m = preg_match_all(/^([A-Z][A-Z0-9]+)((main)|(current)|(next)|(day)|(\d{4}))$/, o.code, 'PREG_SET_ORDER'); //大写字母开头后面跟...富途海外期货.具体哪个市场的还得逐个判断
		if (count(m) && count(m[0])) { //默认是香港市场的期货,在switch中逐个判断
			let c = m[0][1]; //把前缀拿出来
			o.secType = 10; //期货类型
			o.main_code = c + "main"; //富途的主连命名
			o.owner_code = o.main_code; //默认到主连
			o.origin_code = o.code; //实际合约代码要通过接口获取的
			o.qotMarket = 1; //1香港市场
			o.trdMarket = o.trdEnv ? 5 : 10; //5期货市场10香港期货模拟市场
			o.secMarket = 1; //1香港市场（股票、窝轮、牛熊、期权、期货等）
			o.calMarket = 1; //1香港市场（含股票、ETFs、窝轮、牛熊、期权、非假期交易期货；不含假期交易期货）
			o.securityFirm = o.trdEnv ? 1 : 0; //0富途/自建模拟;1:富途证券(香港);2:moomoo证券(美国);
			o.quote = 1; //1富途的websocket服务;
			o.trade = o.trdEnv ? 1 : 92; //1富途的websocket服务;92自建前端仿真;
			o.tmode = o.trdEnv ? 0 : 2; //富途推送完善的逐笔和十档摆盘
			switch (c) {
				case 'MHI': { //小恒指
					o.owner_code = '800000';
					break;
				}
				case 'HSI': { //恒指期货
					o.owner_code = '800000';
					break;
				}
			}
			if (in_array(c, ['MNQ', 'MYM'])) { //默认是港期,美期要手动指定[可以放到config中]
				o.qotMarket = 11; //11美国市场
				o.trdMarket = o.trdEnv ? 5 : 11; //5期货市场11美国期货模拟市场
				o.secMarket = 2; //2美国市场（股票、期权、期货等）
				o.calMarket = 2; //2美国市场（含股票、ETFs、期权；不含期货）
			}
			if (m[0][7]) { //指定了当期合约 MHI2507 格式
				o.origin_code = c + m[0][7];
			}
			return o;
		}
		m = preg_match_all(/^((KQ\.m@){0,1}(CFFEX|SHFE|DCE|CZCE|INE|SSE|SZSE|GFEX){1}\.([a-zA-Z]+)(\d+){0,1})$/, o.code, 'PREG_SET_ORDER');
		if (count(m) && count(m[0])) { //天勤支持的大陆期货主连或实际合约,形如: DCE.eb2602 KQ.m@DCE.eb
			o.secType = 10; //期货类型
			o.main_code = `KQ.m@${m[0][3]}.${m[0][4]}`; //天勤的主连命名
			o.owner_code = o.main_code; //默认到主连,后续会被修正
			o.origin_code = o.code; //实际合约代码,如果是主连,不能直接交易必须通过接口转成主连对应实际合约
			o.qotMarket = 20; //20 天勤市场[自创]
			o.trdMarket = 5; //5期货市场
			o.secMarket = 101; //101大陆期货[自创]
			o.calMarket = 1; //3大陆市场
			o.securityFirm = o.trdEnv ? 101 : 0; //0自建模拟;101:天勤接口[自创]
			o.quote = 11; //11天勤的websocket行情
			o.trade = o.trdEnv ? 11 : 92; //11天勤的websocket交易;92自建前端仿真;
			o.tmode = o.trdEnv ? 0 : 2;
			return o;
		}
		m = preg_match_all(/^((KQD\.m@){1}([A-Z]+)\.([A-Z\d]+))$/, o.code, 'PREG_SET_ORDER');
		if (count(m) && count(m[0])) { //天勤支持的海外期货主连[只有延迟行情,不能交易]
			o.secType = 10; //期货类型
			o.main_code = `KQD.m@${m[0][3]}.${m[0][4]}`; //天勤的主连命名
			o.owner_code = o.main_code; //默认到主连
			o.origin_code = o.code; //这里得手动更改了
			o.qotMarket = 11; //11美国市场
			o.trdMarket = o.trdEnv ? 5 : 11; //5期货市场11美国期货模拟市场
			o.secMarket = 2; //2美国市场（股票、期权、期货等）
			o.calMarket = 2; //2美国市场（含股票、ETFs、期权；不含期货）
			o.securityFirm = o.trdEnv ? 1 : 0; //0富途/自建模拟;1:富途证券(香港);2:moomoo证券(美国);
			o.quote = 11; //11天勤的websocket行情
			o.trade = o.trdEnv ? 1 : 92; //1富途的websocket服务;92自建前端仿真;
			o.tmode = o.trdEnv ? 0 : 2;
			if (o.trdEnv) { //行情用天勤,交易用富途,这里必须手动更改[延时行情,这里仅演示]
				switch (o.main_code) {
					case 'KQD.m@CME.MNQ': { //微型纳指
						o.origin_code = 'MNQ2603'; //用富途交易
						break;
					}
					case 'KQD.m@CBOT.MYM': { //微型道指
						o.origin_code = 'MYM2603'; //用富途交易
						break;
					}
				}
			}
			return o;
		}
		return o;
	};
	/**
	 * 返回完整标的个性化设置
	 * @param {type} main_code
	 * @returns {Number}
	 */
	this.props = function(main_code) {
		let prop = Object.assign({}, config.props[main_code]);
		prop.lots = intval(prop.lots);
		if (prop.lots <= 0) { //每订单多少手
			prop.lots = 1;
		}
		prop.maxq = intval(prop.maxq);
		if (prop.maxq <= 0) { //最多订单数量
			prop.maxq = 5;
		}
		prop.marg = intval(prop.marg);
		if (prop.marg <= 0) { //保证金比例
			prop.marg = 100;
		}
		prop.fees = Object.assign({}, prop.fees);
		prop.fees = new Function(`return [${prop.fees[0]}, ${prop.fees[1]}]`)();
		if (!is_numeric(prop.fees[0])) {
			prop.fees[0] = 0;
		}
		if (!is_numeric(prop.fees[1])) {
			prop.fees[1] = 0;
		}
		prop.fill = Object.assign({}, prop.fill);
		prop.fill = new Function(`return [intval(${prop.fill[0]}), boolval(intval(${prop.fill[1]}))]`)();
		if (prop.fill[0] < 1) { //买入时比报价低几个档(以当前报价,买一价,买二价...)
			prop.fill[0] = 1;
		}
		prop.gear = Object.assign({}, prop.gear);
		prop.gear = new Function(`return [intval(${prop.gear[0]}), intval(${prop.gear[1]})]`)();
		if (prop.gear[0] <= 0) {
			prop.gear[0] = 5;
		}
		if (prop.gear[1] <= 0) {
			prop.gear[1] = 1;
		}
		for (let type in KL2SUB) {
			type = +type; //转成整型
			prop[type] = Object.assign({}, prop[type]);
			prop[type] = new Function(`return [intval(${prop[type][0]}), intval(${prop[type][1]})]`)();
			if (prop[type][0] <= 0) { //每yGrid显示多少档
				let n = 20;
				switch (type) {
					case 2: //日K
						n = 200;
						break;
				}
				prop[type][0] = n;
			}
			if (prop[type][1] <= 0) { //成交量坐标容纳多少K
				let n = 2;
				switch (type) {
					case 2: //日K
						n = 20000;
						break;
				}
				prop[type][1] = n;
			}
		}
		return prop;
	}
}