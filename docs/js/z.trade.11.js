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
/**
 * 交易下单与改单涉及金融秩序，超频或超量调用接口将触发各交易所的防范风控。
 * 
 * 有好心人汇总了这些防范规则，地址：https://www.founderfu.com/ （路径：“客户服务” -> “交易指南” -> 期货交易规则/申报费标准/手续费标准）
 * 
 * 注意事项：
 * 除上述公示规则外，还需注意未明文公示的行业默认限制（例如：每秒下单上限 6 次）。
 */
"use strict";
const _this = self;
_this.importScripts("./dexie.min.js");
_this.importScripts("./jose.umd.min.js");
_this.importScripts("./locutus.min.js");
_this.importScripts("./config.js?_=" + Math.random());
_this.importScripts("./common.js?_=" + Math.random());
_this.Q = {
	mdurl: '', //行情服务器
	tdurl: '', //交易服务器
	access_token: '',
	grants: {}, //从access_token解析出来的授权等信息
	client_mac_address: '',
	client_system_info: '',
	unlock: false, //是否解锁,解锁标识前端准备完毕
	ready: false, //数据是否准备妥当
	isAnonymous: empty(config.trade[11]["tqsdk_proxy"]) //是否匿名
};
_this.uid = 0;
_this.kvs = {}; //key-value-storage
_this.db = null; //Dexie存储器
_this.wss = {};
_this.NEW = {}; //服务端返回的最新数据合并而成的截面
_this.task = new Array();
_this.qq = new Array(); //用于限频
_this.STAT = new Array(); //statistic 统计订单数量
_this.insert_order_list = new Array(); //改单逻辑:先撤单,等待响应,再下新单
/**
 * 验证
 * @returns 
 */
function get_headers() {
	return {
		"Authorization": "Bearer " + Q.access_token,
		"Accept": "application/json",
		"User-Agent": "tqsdk-python 3.9.9"
	};
}
/**
 * 第一步: 登录快期系统
 * @returns
 */
function get_auth_token() {
	let key = implode('-', ['access_token', md5(config.trade[11]["shinnytech_username"] + "@@@:@@@" + config.trade[11]["shinnytech_password"])]);
	if (_this.kvs[key]) {
		Q.access_token = _this.kvs[key];
		return get_td_url();
	}
	return _this.fetch(config.trade[11]["tqsdk_proxy"], {
		method: "POST",
		headers: {
			'Accept': 'application/json'
		},
		body: json_encode({
			"method": "POST",
			"uri": "https://auth.shinnytech.com/auth/realms/shinnytech/protocol/openid-connect/token",
			"headers": get_headers(),
			"data": {
				"username": config.trade[11]["shinnytech_username"],
				"password": config.trade[11]["shinnytech_password"],
				"grant_type": "password",
				"client_id": "shinny_tq",
				"client_secret": "be30b9f4-6862-488a-99ad-21bde0400081"
			}
		})
	}).then(function(response) {
		if (response.status == 200) {
			return response.json();
		}
	}).then(function(m) {
		if (m && m.access_token) {
			Q.access_token = m.access_token;
			//m.access_token
			//m.expires_in
			//m.refresh_token
			//m.refresh_expires_in
			//m.session_state
			//m.token_type
			//let claims = jose.decodeJwt(m.access_token);
			//console.log(claims)
			return _this.db.table("z-kvs").put({
				type: 11,
				key: key,
				value: m.access_token,
				expire: time() + 1 * 60 * 60
			});
		}
		console.log(m); //有可能账户或密码错误
	}).catch(function(e) {
		//console.log(e);
	}).finally(function() {
		get_td_url();
	});
}
/**
 * 授权信息[得到VIP账户的过期时间,没什么用,跳过]
 * @returns
 */
function get_auth_grant() {
	return _this.fetch(config.trade[11]["tqsdk_proxy"], {
		method: "POST",
		headers: {
			'Accept': 'application/json'
		},
		body: json_encode({
			"method": "GET",
			"uri": "https://auth.shinnytech.com/auth/realms/shinnytech/rest/get-grant/tq",
			"headers": get_headers(),
			"data": {}
		})
	}).then(function(response) {
		if (response.status == 200) {
			return response.json();
		}
	}).then(function(m) {
		//console.log(m);
	}).catch(function(e) {
		//console.log(e);
	}).finally(function() {});
}
/**
 * 行情第二步: 获取行情服务器地址
 * @returns 
 */
function get_md_url() {
	let stock = 'true'; //注意这里必须是小写字符串
	let backtest = 'false'; //是否复盘服务器
	let key = implode('-', ['mdurl', stock, backtest]); //两个参数唯一确定一条地址
	if (_this.kvs[key]) {
		Q.mdurl = _this.kvs[key];
		return _this._open();
	}
	return _this.fetch(config.trade[11]["tqsdk_proxy"], {
		method: "POST",
		headers: {
			'Accept': 'application/json'
		},
		body: json_encode({
			"method": "GET",
			"uri": "https://api.shinnytech.com/ns",
			"headers": get_headers(),
			"data": {
				"stock": stock,
				"backtest": backtest
			}
		})
	}).then(function(response) {
		if (response.status == 200) {
			return response.json();
		}
	}).then(function(m) {
		if (m && m.mdurl) {
			Q.mdurl = m.mdurl;
			_this.db.table("z-kvs").put({
				type: 11,
				key: key,
				value: m.mdurl,
				expire: time() + 1 * 60 * 60
			});
		}
	}).catch(function(e) {
		//console.log(e);
	}).finally(function() {
		_this._open();
	});
}
/**
 * 交易第二步: 获取交易服务器地址
 * @returns 
 */
function get_td_url() {
	let key = implode('-', ['tdurl', md5(config.trade[11]["broker_bid"])]);
	if (_this.kvs[key]) {
		Q.tdurl = _this.kvs[key];
		return get_system_info();
	}
	return _this.fetch(config.trade[11]["tqsdk_proxy"], {
		method: "POST",
		headers: {
			'Accept': 'application/json'
		},
		body: json_encode({
			"method": "GET",
			"uri": "https://files.shinnytech.com/" + config.trade[11]["broker_bid"] + ".json",
			"headers": get_headers(),
			"data": {
				"account_id": config.trade[11]["broker_account_id"],
				"auth": config.trade[11]["shinnytech_username"]
			}
		})
	}).then(function(response) {
		if (response.status == 200) {
			return response.json();
		}
	}).then(function(m) {
		if (m && m[config.trade[11]["broker_bid"]]) {
			if (in_array('TQ', m[config.trade[11]["broker_bid"]]['category'])) {
				Q.tdurl = m[config.trade[11]["broker_bid"]]['url'];
				_this.db.table("z-kvs").put({
					type: 11,
					key: key,
					value: Q.tdurl,
					expire: time() + 1 * 60 * 60
				});
			}
		}
	}).catch(function(e) {
		//console.log(e);
	}).finally(function() {
		get_system_info();
	});
}
/**
 * 交易第三步: 获取系统信息
 * @returns 
 */
function get_system_info() {
	return _this.fetch(config.trade[11]["tqsdk_proxy"], {
		method: "POST",
		headers: {
			'Accept': 'application/json'
		},
		body: json_encode({
			'act': 'GetSystemInfo'
		})
	}).then(function(response) {
		if (response.status == 200) {
			return response.json();
		}
	}).then(function(m) {
		if (m && m["client_mac_address"] && m["client_system_info"]) {
			_this.Q.client_mac_address = m.client_mac_address;
			_this.Q.client_system_info = m.client_system_info;
		}
	}).catch(function(e) {
		//console.log(e);
	}).finally(function() {
		_this._open();
	});
}
/**
 * 把订单转成兼容富途:这里只拿到当前时段的,并不是夜盘加上日盘的
 * @returns 
 */
function _orders(filterStatusList) {
	let orderList = [];
	_this.STAT = new Array(); //每次都是遍历所有订单(没有考虑性能)
	if (NEW.trade && NEW.trade[_this.uid] && NEW.trade[_this.uid]["orders"]) {
		for (let orderIDEx in NEW.trade[_this.uid]["orders"]) {
			let o = NEW.trade[_this.uid]["orders"][orderIDEx];
			let code = implode(".", [o["exchange_id"], o["instrument_id"]]);
			let [prefix, remark, contractSize, hash] = explode('_', o["order_id"]); //提取...

			if (empty(_this.STAT[code])) { //0总计订单数,1生效中的订单数,2全部成交订单数,3撤单或失败订单数
				_this.STAT[code] = [0, 0, 0, 0];
			}
			_this.STAT[code][0]++;

			let orderStatus = 5;
			if (o["status"] == "ALIVE") {
				orderStatus = 5;
				_this.STAT[code][1]++;
			}
			if (o["status"] == 'FINISHED') { //默认是全部成交
				orderStatus = 11;
				if (empty(trim(o["exchange_order_id"]))) { //被拒绝的单
					orderStatus = 21; //下单失败
					_this.STAT[code][3]++;
				} else if (o["volume_left"] == 0) { //全部成交
					orderStatus = 11;
					_this.STAT[code][2]++;
				} else if (o["volume_left"] == o["volume_orign"]) { //已撤单:全部
					orderStatus = 15;
					_this.STAT[code][3]++;
				} else if (o["volume_left"] < o["volume_orign"]) { //部分完成,剩余部分已撤单
					orderStatus = 14;
					_this.STAT[code][3]++;
				}
			}
			let trdSide = 0;
			if (o["direction"] == "BUY" && in_array(o["offset"], ["OPEN"])) { //多头开仓
				trdSide = 1;
			}
			if (o["direction"] == "SELL" && in_array(o["offset"], ["CLOSE", "CLOSETODAY"])) { //多头平仓
				trdSide = 2;
			}
			if (o["direction"] == "SELL" && in_array(o["offset"], ["OPEN"])) { //空头开仓
				trdSide = 3;
			}
			if (o["direction"] == "BUY" && in_array(o["offset"], ["CLOSE", "CLOSETODAY"])) { //空头平仓
				trdSide = 4;
			}
			if (in_array(orderStatus, [14, 15]) && isset(_this.insert_order_list[o['order_id']])) { //改单/平出/强出动作:先撤单,等待成功,再挂单
				_this._send(insert_order_list[o['order_id']]);
				delete insert_order_list[o['order_id']];
			}
			if (count(filterStatusList) && !in_array(orderStatus, filterStatusList)) { //要过滤
				continue;
			}
			orderList.push({
				orderIDEx: o["order_id"],
				lastErrMsg: in_array(orderStatus, [21]) ? o["last_msg"] : "", //下单失败:交易所没有接受,比如保证金不足
				trdSide: trdSide,
				code: code,
				name: code,
				remark: floatval(remark),
				orderType: 1, //订单类型:1限价单
				orderStatus: orderStatus,
				qty: o["volume_orign"],
				fillQty: o["volume_orign"] - o["volume_left"],
				fillAvgPrice: o["limit_price"], //没有该字段
				price: o["limit_price"],
				createTimestamp: o["insert_date_time"] / 1000000000,
				updateTimestamp: o["insert_date_time"] / 1000000000
			});
		}
	}
	return orderList;
}
/**
 * 把成交转成兼容富途.
 * @returns 
 */
function _fills() {
	let orderFillList = [];
	if (NEW.trade && NEW.trade[_this.uid] && NEW.trade[_this.uid]["trades"]) {
		for (let fillIDEx in NEW.trade[_this.uid]["trades"]) {
			let o = NEW.trade[_this.uid]["trades"][fillIDEx];
			let trdSide = 0;
			if (o["direction"] == "BUY" && in_array(o["offset"], ["OPEN"])) { //多头开仓
				trdSide = 1;
			}
			if (o["direction"] == "SELL" && in_array(o["offset"], ["CLOSE", "CLOSETODAY"])) { //多头平仓
				trdSide = 2;
			}
			if (o["direction"] == "SELL" && in_array(o["offset"], ["OPEN"])) { //空头开仓
				trdSide = 3;
			}
			if (o["direction"] == "BUY" && in_array(o["offset"], ["CLOSE", "CLOSETODAY"])) { //空头平仓
				trdSide = 4;
			}
			let code = implode(".", [o["exchange_id"], o["instrument_id"]]);
			let orderIDEx = implode("|", [o["order_id"], trim(o["exchange_trade_id"])]);
			orderFillList.push({
				fillIDEx: fillIDEx, //这里必须保持原样
				orderIDEx: orderIDEx,
				trdSide: trdSide,
				code: code,
				name: code,
				qty: o["volume"],
				price: o["price"],
				createTimestamp: o["trade_date_time"] / 1000000000,
				updateTimestamp: o["trade_date_time"] / 1000000000,
				trdMarket: 5, //以下为兼容:历史成交接口要用
				uid: _this.uid,
				orderStatus: 11,
				fillAvgPrice: o["price"],
				fillQty: o["volume"]
			});
		}
		_this.db.table("z-orders").bulkPut(orderFillList); //***可以在这个地方调用服务端入库操作***
	}
	return orderFillList;
}
_this._send = function(pack) {
	if (_this.wss.readyState == WebSocket.OPEN) {
		_this.wss.send(json_encode(pack));
	}
};
_this._open = function() {
	if (empty(Q.tdurl)) {
		return _this.post({
			proto: 1001,
			serialNo: 0
		}, {
			'retType': -1,
			'retMsg': '无交易地址!'
		});
	}
	if (empty(Q.access_token)) {
		return _this.post({
			proto: 1001,
			serialNo: 0
		}, {
			'retType': -1,
			'retMsg': '登录出错了!'
		});
	}
	if (empty(Q.client_system_info)) {
		return _this.post({
			proto: 1001,
			serialNo: 0
		}, {
			'retType': -1,
			'retMsg': '无硬件信息!'
		});
	}
	let claims = jose.decodeJwt(Q.access_token);
	if (config.trade[11]["broker_bid"] == '快期模拟') {
		config.trade[11]["broker_account_id"] = claims["sub"];
		config.trade[11]["broker_account_password"] = claims["sub"];
	}
	_this.uid = config.trade[11]["broker_account_id"]; //兼容
	_this.wss = new WebSocket(config.trade[11]["tqsdk_proxy"]);
	_this.wss.addEventListener('open', function(e) {
		_this._send({
			proto: 1001,
			c2s: {
				"uri": _this.Q.tdurl,
				"headers": get_headers()
			}
		});
	});
	_this.wss.addEventListener('message', function(e) {
		_this._send({
			"aid": "peek_message"
		});
		let diff = {}; //此次合计更新了哪些片段
		let m = json_decode(e.data);
		if (m.aid == 'rtn_brokers') { //连接成功响应
			delete m.aid;
			diff = array_replace_recursive(diff, m);
		}
		if (m.aid == 'rtn_data') { //[aid 字段为 rtn_data 表示该包的类型为业务信息截面更新包]
			for (let i in m.data) { //实现了再说,不考虑性能
				if (empty(m.data[i])) {
					continue;
				}
				m.data[i] = array_diff_assoc_recursive(m.data[i], NEW); //提取出仅改变的字段
				if (empty(m.data[i])) {
					continue;
				}
				diff = array_replace_recursive(diff, m.data[i]);
			}
		}
		if (empty(diff)) { //什么都没改
			return true;
		}
		NEW = array_replace_recursive(NEW, diff); //合并到主干
		if (diff["brokers"]) { //返回了柜台信息说明准备完毕
			_this._send({
				'aid': 'req_login',
				'bid': config.trade[11]["broker_bid"],
				'user_name': config.trade[11]["broker_account_id"],
				'password': config.trade[11]["broker_account_password"],
				'client_app_id': 'SHINNY_TQ_1.0',
				'client_mac_address': Q.client_mac_address,
				'client_system_info': Q.client_system_info
			});
			_this._send({ //自动发送确认结算单
				'aid': 'confirm_settlement'
			});
		}
		if (diff["notify"]) {
			for (let k in NEW["notify"]) {
				let a = NEW["notify"][k];
				delete NEW["notify"][k];
				console.log(structuredClone(a));
				in_array(a["code"], [321, 328, 329, 331, 336]) || _this.post({ //模拟后端推送消息
					proto: 1003,
					serialNo: 0
				}, {
					s2c: {
						type: -2,
						event: {
							eventType: -2,
							desc: json_encode({
								"desc": a['content'],
								"news": [],
								"gaps": [],
								"events": []
							})
						}
					}
				});
			}
		}
		if (diff["trade"] && NEW["trade"][_this.uid] && (NEW["trade"][_this.uid]["trade_more_data"] === false)) { //账户相关资料全部加载完成
			if (Q.ready) {
				if (Q.unlock && diff["trade"][_this.uid] && diff["trade"][_this.uid]["orders"]) { //推送订单更新[每次推一条订单]
					let orderList = _this._orders([]);
					for (let orderIDEx in diff["trade"][_this.uid]["orders"]) { //其实每次只会来一条
						for (let i in orderList) {
							if (orderList[i]["orderIDEx"] == orderIDEx) {
								_this.post({
									proto: 2208
								}, {
									s2c: {
										order: orderList[i]
									}
								});
							}
						}
					}
				}
				if (Q.unlock && diff["trade"][_this.uid] && diff["trade"][_this.uid]["trades"]) { //新的成交,只有成交才来调用很少
					let orderFillList = _this._fills();
					for (let fillIDEx in diff["trade"][_this.uid]["trades"]) { //其实每次只会来一条
						for (let i in orderFillList) {
							if (orderFillList[i]["fillIDEx"] == fillIDEx) {
								_this.post({
									proto: 2218
								}, {
									s2c: {
										orderFill: orderFillList[i]
									}
								});
							}
						}
					}
				}
				if (diff["trade"][_this.uid] && diff["trade"][_this.uid]["positions"]) { //持仓有更新,这里调用非常频繁
				}
			} else {
				Q.ready = true;
				_this.post({
					proto: 1001,
					serialNo: 0
				}, {
					s2c: {}
				});
			}
		}
	});
	_this.wss.addEventListener('error', function(e) {
		_this.post({
			proto: 1001,
			serialNo: 0
		}, {
			'retType': -1,
			'retMsg': '连接出错了!'
		});
	});
	_this.wss.addEventListener('close', function(e) {
		_this.post({
			proto: 1001,
			serialNo: 0
		}, {
			'retType': -1,
			'retMsg': '连接已关闭!'
		});
	});
};
/**
 * 初始化连接
 * @param {type} m
 * @returns {undefined}
 */
_this.task[-1001] = function(m) {
	if (empty(m.c2s)) {
		return _this.post(m, {
			'retType': -1,
			'retMsg': '错误的包体!'
		});
	}
	if (_this.db instanceof Dexie) {
		return _this.post(m, {
			'retType': -1,
			'retMsg': '初始化重复!'
		});
	}
	if (Q.isAnonymous) {
		return _this.post(m, {
			'retType': -1,
			'retMsg': '无中继服务!'
		});
	}
	_this.db = initdb(); //
	_this.db.open().then(function() {
		return _this.db.table("z-kvs").where("expire").between(1, time()).delete().then(function(n) {
			return _this.db.table("z-kvs").each(function(a) {
				if (a.type == 11) {
					_this.kvs[a.key] = a.value;
				}
			});
		}).then(function() {
			return get_auth_token();
		});
	}).catch(function(e) {
		console.log(e.stack || e);
	});
};
/**
 * 获取交易账户列表
 * @param {type} m
 * @returns {undefined}
 */
_this.task[2001] = function(m) {
	if (empty(m.c2s)) {
		return _this.post(m, {
			'retType': -1,
			'retMsg': '错误的内容体!'
		});
	}
	return _this.post(m, {
		s2c: {
			accList: {}
		}
	});
};
/**
 * 解锁交易(30秒10次) 真实富途交易的下单+改单需要先解锁[此处做兼容用]
 * @param {type} m
 * @returns {undefined}
 */
_this.task[2005] = function(m) {
	if (empty(m.c2s)) {
		return _this.post(m, {
			'retType': -1,
			'retMsg': '错误的内容体!'
		});
	}
	Q.unlock = true;
	return _this.post(m, {
		s2c: {}
	});
};
/**
 * 订阅交易推送[此处做兼容用]
 * @param {type} m
 * @returns {undefined}
 */
_this.task[2008] = function(m) {
	if (empty(m.c2s)) {
		return _this.post(m, {
			'retType': -1,
			'retMsg': '错误的内容体!'
		});
	}
	return _this.post(m, {
		s2c: {}
	});
};
/**
 * 查询今日订单
 * @param {type} m
 * @returns {undefined}
 */
_this.task[2201] = function(m) {
	if (empty(m.c2s)) {
		return _this.post(m, {
			'retType': -1,
			'retMsg': '错误的内容体!'
		});
	}
	if (empty(m.c2s.header)) {
		return _this.post(m, {
			'retType': -1,
			'retMsg': '错误的标题头!'
		});
	}
	let filterStatusList = array_merge(m['c2s']['filterStatusList']);
	let refreshCache = boolval(m['c2s']['refreshCache']);
	let zero = mktime(0, 0, 0);
	let beginTime = zero + 9 * 60 * 60;
	let endTime = zero + 27 * 60 * 60; //恒指期货3点收盘
	let s2c = {};
	s2c.header = m.c2s.header;
	s2c.orderList = _this._orders(filterStatusList);
	return _this.post(m, {
		s2c: s2c
	});
};
/**
 * 查询今日成交
 * @param {type} m
 * @returns {undefined}
 */
_this.task[2211] = function(m) {
	if (empty(m.c2s)) {
		return _this.post(m, {
			'retType': -1,
			'retMsg': '错误的内容体!'
		});
	}
	if (empty(m.c2s.header)) {
		return _this.post(m, {
			'retType': -1,
			'retMsg': '错误的标题头!'
		});
	}
	let refreshCache = boolval(m['c2s']['refreshCache']);
	let zero = mktime(0, 0, 0);
	let beginTime = zero + 9 * 60 * 60;
	let endTime = zero + 27 * 60 * 60; //恒指期货3点收盘
	let s2c = {};
	s2c.header = m.c2s.header;
	s2c.orderFillList = _this._fills();
	return _this.post(m, {
		s2c: s2c
	});
};
/**
 * 查询历史成交[兼容用途]快期只能查当天成交
 * @param {type} m
 * @returns {undefined}
 */
_this.task[2222] = function(m) {
	if (empty(m.c2s)) {
		return _this.post(m, {
			'retType': -1,
			'retMsg': '错误的内容体!'
		});
	}
	if (empty(m.c2s.header)) {
		return _this.post(m, {
			'retType': -1,
			'retMsg': '错误的标题头!'
		});
	}
	if (empty(m.c2s.filterConditions)) {
		return _this.post(m, {
			'retType': -1,
			'retMsg': '错误的过滤器!'
		});
	}
	if (_this.limit(2222, 30, 10, 0) == false) {
		return _this.post(m, {
			'retType': -1,
			'retMsg': '超出查询频率!'
		});
	}
	let beginTime = strtotime(m.c2s.filterConditions['beginTime']);
	let endTime = strtotime(m.c2s.filterConditions['endTime']);
	let s2c = {};
	s2c.header = m.c2s.header;
	s2c.orderFillList = [];
	_this.db.table("z-orders").where("uid").equals(_this.uid).and(function(o) {
		return (o.trdMarket == m.c2s.header['trdMarket']) && in_array(o.orderStatus, [11, 14]) && (o.updateTimestamp >= beginTime) && (o.updateTimestamp < endTime);
	}).each(function(o) {
		s2c.orderFillList.push(array_merge(o, {
			'fillIDEx': o['orderIDEx'],
			'price': o['fillAvgPrice'],
			'qty': o['fillQty']
		}));
	}).then(function() {
		return _this.post(m, {
			s2c: s2c
		});
	});
};
/**
 * 查询交易业务账户的持仓列表.前端收到订单更新后延迟了250毫秒才来调用此接口,可以认为拿到了最新数据
 * @param {type} m
 * @returns {undefined}
 */
_this.task[2102] = function(m) {
	if (empty(m.c2s)) {
		return _this.post(m, {
			'retType': -1,
			'retMsg': '错误的内容体!'
		});
	}
	if (empty(m.c2s.header)) {
		return _this.post(m, {
			'retType': -1,
			'retMsg': '错误的标题头!'
		});
	}
	let wlist = {}; //根据订单和成交计算的值,有些是为了计算持仓盈利,有些在下单处需要用
	function W(code) { //返回的是wlist的引用
		if (empty(wlist[code])) {
			wlist[code] = {
				pos_long_remark: 0, //总投入成本
				pos_short_remark: 0,
				contractSize: 1,
				pos_long_frozen: 0,
				pos_long_frozen_his: 0,
				pos_long_frozen_today: 0,
				pos_short_frozen: 0, //已挂单数量
				pos_short_frozen_his: 0, //已挂单昨开数量
				pos_short_frozen_today: 0, //已挂单今开数量
				pos_long_plVal: 0, //已结算盈亏金额
				pos_long_today_plVal: 0, //今日已结算盈亏金额
				pos_long_today_qty: 0, //今日持仓
				pos_long_today_trdVal: 0, //今日成交额
				pos_long_today_buyQty: 0, //今日买入量
				pos_long_today_buyVal: 0, //今日买入总额
				pos_long_today_sellQty: 0, //今日卖出量
				pos_long_today_sellVal: 0, //今日卖出总额
				pos_short_plVal: 0, //已结算盈亏金额
				pos_short_today_plVal: 0, //今日已结算盈亏金额
				pos_short_today_qty: 0, //今日持仓
				pos_short_today_trdVal: 0, //今日成交额
				pos_short_today_buyQty: 0, //今日买入量
				pos_short_today_buyVal: 0, //今日买入总额
				pos_short_today_sellQty: 0, //今日卖出量
				pos_short_today_sellVal: 0 //今日卖出总额
			};
		}
		return wlist[code];
	}
	let s2c = {};
	s2c.header = m.c2s.header;
	s2c.positionList = [];
	if (NEW.trade && NEW.trade[_this.uid] && (NEW["trade"][_this.uid]["trade_more_data"] === false)) { //确保完整
		for (let orderIDEx in NEW.trade[_this.uid]["orders"]) { //根据生效订单计算冻结的数量[天勤文档写明volume_*不推荐使用了]
			let o = NEW.trade[_this.uid]["orders"][orderIDEx];
			let [prefix, remark, contractSize, hash] = explode('_', o["order_id"]); //提取...[只支持本系统下的单]
			let code = implode(".", [o["exchange_id"], o["instrument_id"]]);
			let w = W(code); //这里是wlist[code]的引用
			w["contractSize"] = floatval(contractSize);
			if (o["status"] != "ALIVE") {
				continue;
			}
			o["volume_orign"] = intval(o["volume_orign"]);
			if (o["direction"] == "BUY" && in_array(o["offset"], ["OPEN"])) { //多头开仓
			}
			if (o["direction"] == "SELL" && in_array(o["offset"], ["CLOSE"])) { //多头平仓
				w["pos_long_frozen"] += o["volume_orign"];
				w["pos_long_frozen_his"] += o["volume_orign"]; //这个值待商榷
			}
			if (o["direction"] == "SELL" && in_array(o["offset"], ["CLOSETODAY"])) { //多头平今
				w["pos_long_frozen"] += o["volume_orign"];
				w["pos_long_frozen_today"] += o["volume_orign"];
			}
			if (o["direction"] == "SELL" && in_array(o["offset"], ["OPEN"])) { //空头开仓
			}
			if (o["direction"] == "BUY" && in_array(o["offset"], ["CLOSE"])) { //空头平仓
				w["pos_short_frozen"] += o["volume_orign"];
				w["pos_short_frozen_his"] += o["volume_orign"];
			}
			if (o["direction"] == "BUY" && in_array(o["offset"], ["CLOSETODAY"])) { //空头平今
				w["pos_short_frozen"] += o["volume_orign"];
				w["pos_short_frozen_today"] += o["volume_orign"];
			}
		}
		let list = array_values(NEW.trade[_this.uid]["trades"] ?? []);
		list.sort(function(a, b) { //按时间排序
			return a.trade_date_time - b.trade_date_time;
		});
		for (let i in list) { //根据成交记录计算今日盈利情况.由于只能拿到今日[前一天的17:00算起]的成交,所以盈利计算只对做日内交易有意义
			let o = list[i];
			let [prefix, remark, contractSize, hash] = explode('_', o["order_id"]); //提取...[只支持本系统下的单]
			let code = implode(".", [o["exchange_id"], o["instrument_id"]]);
			let w = W(code); //这里是wlist[code]的引用
			w["contractSize"] = floatval(contractSize);
			remark = floatval(remark);
			o["price"] = floatval(o["price"]);
			o["volume"] = intval(o["volume"]);
			if (o["direction"] == "BUY" && in_array(o["offset"], ["OPEN"])) { //多头开仓
				w["pos_long_today_qty"] += o["volume"]; //今日持仓
				w["pos_long_today_trdVal"] += (o["volume"] * o["price"]); //今日成交额
				w["pos_long_today_buyQty"] += o["volume"]; //今日买入量
				w["pos_long_today_buyVal"] += (o["volume"] * o["price"]); //今日买入总额
			}
			if (o["direction"] == "SELL" && in_array(o["offset"], ["CLOSE", "CLOSETODAY"])) { //多头平仓
				let volume = min(w["pos_long_today_qty"], o["volume"]); //有多少够平今的.卖出量比买入量多,说明平了昨开仓
				w["pos_long_today_qty"] -= volume; //今日持仓
				w["pos_long_today_trdVal"] += (volume * o["price"]); //今日成交额
				w["pos_long_today_sellQty"] += volume; //今日卖出量
				w["pos_long_today_sellVal"] += (volume * o["price"]); //今日卖出总额
				w["pos_long_today_plVal"] += (volume * (o["price"] - remark) * w["contractSize"]); //今日已结算盈亏: 手数*差价*合约乘数
				w["pos_long_plVal"] += (o["volume"] * (o["price"] - remark) * w["contractSize"]); //已结算盈亏
				w["pos_long_remark"] += o["volume"] * remark;
			}
			if (o["direction"] == "SELL" && in_array(o["offset"], ["OPEN"])) { //空头开仓
				w["pos_short_today_qty"] += o["volume"]; //今日持仓
				w["pos_short_today_trdVal"] += (o["volume"] * o["price"]); //今日成交额
				w["pos_short_today_buyQty"] += o["volume"]; //今日买入量
				w["pos_short_today_buyVal"] += (o["volume"] * o["price"]); //今日买入总额
			}
			if (o["direction"] == "BUY" && in_array(o["offset"], ["CLOSE", "CLOSETODAY"])) { //空头平仓
				let volume = min(w["pos_short_today_qty"], o["volume"]);
				w["pos_short_today_qty"] -= volume; //今日持仓
				w["pos_short_today_trdVal"] += (volume * o["price"]); //今日成交额
				w["pos_short_today_sellQty"] += volume; //今日卖出量
				w["pos_short_today_sellVal"] += (volume * o["price"]); //今日卖出总额
				w["pos_short_today_plVal"] += (volume * (remark - o["price"]) * w["contractSize"]); //今日已结算盈亏: 手数*差价*合约乘数
				w["pos_short_plVal"] += (o["volume"] * (remark - o["price"]) * w["contractSize"]); //已结算盈亏
				w["pos_short_remark"] += o["volume"] * remark;
			}
		}
		for (let code in NEW.trade[_this.uid]["positions"]) { //前端是先查询持仓,如有仓位再进行自动挂单,所以这里计算出pos_long_frozen是有效的
			let p = Object.assign(NEW.trade[_this.uid]["positions"][code], W(code)); //注意这里p是持仓的引用,下单处还需要这些
			p["pos_long"] = intval(p['pos_long_his']) + intval(p['pos_long_today']); //补齐天勤文档上的字段.!!!持仓+订单+成交 这三个并没有保证原子性,所以有数据不一致的概率
			p["pos_short"] = intval(p['pos_short_his']) + intval(p['pos_short_today']);
			p["pos"] = p["pos_long"] - p["pos_short"];
			p["last_price"] = floatval(p["last_price"]); //市价
			p["open_price_long"] = floatval(p["open_price_long"]); //多头开仓均价,以开仓价来统计
			p["open_price_short"] = floatval(p["open_price_short"]);
			p["float_profit_long"] = p["pos_long"] * (p["last_price"] - p["open_price_long"]) * p["contractSize"]; //持仓浮动盈亏
			p["float_profit_short"] = p["pos_short"] * (p["open_price_short"] - p["last_price"]) * p["contractSize"];
			p["pos_long_remark"] += p["open_price_long"] * p["pos_long"]; //总投入
			p["pos_long_remark"] *= p["contractSize"];
			p["pos_short_remark"] += p["open_price_short"] * p["pos_short"];
			p["pos_short_remark"] *= p["contractSize"];
			s2c.positionList.push({
				positionID: unique(implode('-', [code, 0])),
				positionSide: 0, //持仓方向:0多仓1空仓
				code: code,
				name: code,
				qty: p["pos_long"],
				canSellQty: p["pos_long"] - p["pos_long_frozen"],
				price: p["last_price"], //市价
				costPrice: p["open_price_long"], //多头开仓均价,以开仓价来统计
				val: p["pos_long"] * p["last_price"],
				plVal: p["pos_long_plVal"] + p["float_profit_long"], //浮动盈亏金额:已结算盈亏+持仓浮动盈亏
				plRatio: p["pos_long_remark"] ? ((p["pos_long_plVal"] + p["float_profit_long"]) / p["pos_long_remark"]) : 0, //盈亏百分比(平均成本价模式)
				td_plVal: p["pos_long_today_plVal"] + p["float_profit_long"] //今日浮动盈亏
			});
			s2c.positionList.push({
				positionID: unique(implode('-', [code, 1])),
				positionSide: 1, //持仓方向:0多仓1空仓
				code: code,
				name: code,
				qty: p["pos_short"],
				canSellQty: p["pos_short"] - p["pos_short_frozen"],
				price: p["last_price"], //市价
				costPrice: p["open_price_short"],
				val: p["pos_short"] * p["last_price"],
				plVal: p["pos_short_plVal"] + p["float_profit_short"],
				plRatio: p["pos_short_remark"] ? ((p["pos_short_plVal"] + p["float_profit_short"]) / p["pos_short_remark"]) : 0, //盈亏百分比(平均成本价模式)
				td_plVal: p["pos_short_today_plVal"] + p["float_profit_short"] //今日浮动盈亏
			});
		}
	}
	return _this.post(m, {
		s2c: s2c
	});
};
/**
 * 下单
 * @param {type} m
 * @returns {undefined}
 */
_this.task[2202] = function(m) {
	if (empty(NEW["trade"])) {
		return _this.post(m, {
			'retType': -1,
			'retMsg': '未经初始化!'
		});
	}
	if (empty(NEW["trade"][_this.uid])) {
		return _this.post(m, {
			'retType': -1,
			'retMsg': '未经初始化!'
		});
	}
	if (empty(m.c2s)) {
		return _this.post(m, {
			'retType': -1,
			'retMsg': '错误的包体!'
		});
	}
	let code = trim(m['c2s']['code']);
	if (empty(code)) {
		return _this.post(m, {
			'retType': -1,
			'retMsg': '代码不正确!'
		});
	}
	let price = abs(m['c2s']['price']);
	if (empty(price)) {
		return _this.post(m, {
			'retType': -1,
			'retMsg': '价格不正确!'
		});
	}
	let qty = abs(intval(m['c2s']['qty']));
	if (empty(qty)) {
		return _this.post(m, {
			'retType': -1,
			'retMsg': '数量不正确!'
		});
	}
	if (empty(m['c2s']['o']) || empty(m['c2s']['o']['contractSize'])) {
		return _this.post(m, {
			'retType': -1,
			'retMsg': '无扩展信息!'
		});
	}
	if (in_array(m['c2s']['o']['secType'], [3, 5, 10]) == false) {
		return _this.post(m, {
			'retType': -1,
			'retMsg': '类型不正确!'
		});
	}
	let trdSide = intval(m['c2s']['trdSide']); //1开多2平多3开空4平空
	let remark = sprintf("%.3f", floatval(m['c2s']['remark'])); //记录成本价
	let contractSize = sprintf("%.3f", floatval(m['c2s']['o']['contractSize']));
	if (in_array(trdSide, [1, 2, 3, 4]) == false) { //这里与富途不同,富途只有1,2
		return _this.post(m, {
			'retType': -1,
			'retMsg': '方向不正确!'
		});
	}
	if (_this.limit(2202, 30, 15, 0.02) == false) {
		return _this.post(m, {
			'retType': -1,
			'retMsg': '超出下单频率!'
		});
	}
	let [exchange_id, instrument_id] = explode(".", code);
	if (empty(exchange_id) || empty(instrument_id)) {
		return _this.post(m, {
			'retType': -1,
			'retMsg': '代码不正确!'
		});
	}
	let p = {}; //当前该标的持仓
	if (NEW.trade && NEW.trade[_this.uid] && NEW.trade[_this.uid]["positions"] && NEW.trade[_this.uid]["positions"][code]) { //有该标的持仓
		p = NEW.trade[_this.uid]["positions"][code];
	}
	let direction;
	let offset;
	if (in_array(trdSide, [1])) { //如果开多
		direction = "BUY";
		offset = "OPEN"; //OPEN=开仓, CLOSE=平仓, CLOSETODAY=平今
	}
	if (in_array(trdSide, [3])) { //如果开空
		if (m['c2s']['o']['secType'] != 10) { //仅期货支持做空
			return _this.post(m, {
				'retType': -1,
				'retMsg': '仅期货能做空!'
			});
		}
		direction = "SELL";
		offset = "OPEN"; //OPEN=开仓, CLOSE=平仓, CLOSETODAY=平今
	}
	if (in_array(trdSide, [2])) { //如果卖出,要看持仓
		if (qty > (intval(p['pos_long']) - intval(p['pos_long_frozen']))) {
			return _this.post(m, {
				'retType': -1,
				'retMsg': '账户持仓不足!'
			});
		}
		direction = "SELL";
		offset = "CLOSE"; //OPEN=开仓, CLOSE=平仓, CLOSETODAY=平今
		if (in_array(exchange_id, ["SHFE", "INE"]) && (qty > (intval(p["pos_long_his"]) - intval(p["pos_long_frozen_his"])))) { //上期所和上期能源分平今/平昨
			offset = "CLOSETODAY";
		}
	}
	if (in_array(trdSide, [4])) { //如果平空,要看持仓
		if (qty > (intval(p['pos_short']) - intval(p['pos_short_frozen']))) {
			return _this.post(m, {
				'retType': -1,
				'retMsg': '账户持仓不足!'
			});
		}
		direction = "BUY";
		offset = "CLOSE"; //OPEN=开仓, CLOSE=平仓, CLOSETODAY=平今
		if (in_array(exchange_id, ["SHFE", "INE"]) && (qty > (intval(p["pos_short_his"]) - intval(p["pos_short_frozen_his"])))) { //上期所和上期能源分平今/平昨
			offset = "CLOSETODAY";
		}
	}
	if (_this.STAT[code] && (_this.STAT[code][0] >= 2500)) { //超过4000要收申报费
		return _this.post(m, {
			'retType': -1,
			'retMsg': '订单数超出!'
		});
	}
	if (_this.STAT[code] && (_this.STAT[code][3] >= 250)) { //撤单超过500触发异常交易监管
		return _this.post(m, {
			'retType': -1,
			'retMsg': '撤单数超出!!'
		});
	}
	_this._send({
		aid: "insert_order",
		user_id: _this.uid,
		order_id: `PYSDK_${remark}_${contractSize}_${md5(mt_rand())}`, //把成本价和合约乘数带到服务端
		exchange_id: exchange_id,
		instrument_id: instrument_id,
		direction: direction, //下单方向, BUY=买, SELL=卖
		offset: offset, //开平标志, OPEN=开仓, CLOSE=平仓, CLOSETODAY=平今
		volume: qty,
		limit_price: price,
		price_type: 'LIMIT',
		time_condition: 'GFD', //时间条件, IOC=立即完成，否则撤销, GFS=本节有效, GFD=当日有效, GTC=撤销前有效, GFA=集合竞价有效
		volume_condition: 'ANY'
	});
};
/**
 * 改价+改量/失效/生效/撤单
 * @param {type} m
 * @returns {undefined}
 */
_this.task[2205] = function(m) {
	if (empty(NEW["trade"]) || empty(NEW["trade"][_this.uid])) {
		return _this.post(m, {
			'retType': -1,
			'retMsg': '未经初始化!'
		});
	}
	if (empty(NEW["trade"][_this.uid]["orders"])) {
		return _this.post(m, {
			'retType': -1,
			'retMsg': '不存在的订单!'
		});
	}
	if (empty(m.c2s)) {
		return _this.post(m, {
			'retType': -1,
			'retMsg': '错误的数据体!'
		});
	}
	if (_this.limit(2205, 30, 20, 0.04) == false) {
		return _this.post(m, {
			'retType': -1,
			'retMsg': '超出改单频率!'
		});
	}
	let header = m['c2s']['header'];
	if (empty(header)) {
		return _this.post(m, {
			'retType': -1,
			'retMsg': '错误的标题头!'
		});
	}
	let modifyOrderOp = intval(m['c2s']['modifyOrderOp']);
	let forAll = boolval(m['c2s']['forAll']);
	if (in_array(modifyOrderOp, [1, 2], true) == false) { //1改单2撤单 3失效4生效
		return _this.post(m, {
			'retType': -1,
			'retMsg': '未知订单操作!'
		});
	}
	let o = {}; //选中的订单
	let orderIDEx = m['c2s']['orderIDEx'];
	if (orderIDEx) { //forAll可以不传此项
		o = NEW["trade"][_this.uid]["orders"][orderIDEx];
		if (empty(o)) {
			return _this.post(m, {
				'retType': -1,
				'retMsg': '不存在的订单!'
			});
		}
		if (o['status'] != 'ALIVE') { //只能更改生效中的订单
			return _this.post(m, {
				'retType': -1,
				'retMsg': '订单状态异常!'
			});
		}
	}
	if (in_array(modifyOrderOp, [2], true)) { //撤单
		let orderIDExs = [];
		if (forAll) {
			orderIDExs = array_keys(NEW["trade"][_this.uid]["orders"]);
		} else if (orderIDEx) {
			orderIDExs = [orderIDEx];
		}
		if (empty(orderIDExs)) {
			return _this.post(m, {
				'retType': -1,
				'retMsg': '没有指定订单!'
			});
		}
		for (let i in orderIDExs) {
			let orderIDEx = orderIDExs[i];
			let a = NEW["trade"][_this.uid]["orders"][orderIDEx];
			if (empty(a)) {
				continue;
			}
			if (a['status'] != 'ALIVE') { //只能更改生效中的订单
				continue;
			}
			_this._send({
				aid: "cancel_order",
				user_id: a['user_id'],
				order_id: a['order_id']
			});
		}
	}
	if (in_array(modifyOrderOp, [1])) { //改价格和数量
		if (empty(o)) {
			return _this.post(m, {
				'retType': -1,
				'retMsg': '不存在的订单!'
			});
		}
		let price = abs(m['c2s']['price']);
		if (empty(price)) {
			return _this.post(m, {
				'retType': -1,
				'retMsg': '订单价格错误!'
			});
		}
		let qty = intval(m['c2s']['qty']);
		if (empty(qty)) {
			return _this.post(m, {
				'retType': -1,
				'retMsg': '订单数量错误!'
			});
		}
		_this._send({ //把老的取消,创建一个新的
			aid: "cancel_order",
			user_id: o['user_id'],
			order_id: o['order_id']
		});
		_this.insert_order_list[o['order_id']] = {
			aid: "insert_order",
			user_id: o['user_id'],
			order_id: preg_replace('/_[^_]*$/', '_' + md5(mt_rand()), o['order_id']), //这里保留了成本价和合约乘数
			exchange_id: o['exchange_id'],
			instrument_id: o['instrument_id'],
			direction: o['direction'],
			offset: o['offset'],
			volume: qty,
			limit_price: price,
			price_type: o['price_type'],
			time_condition: o['time_condition'],
			volume_condition: o['volume_condition']
		};
	}
	return _this.post(m, {
		's2c': {
			'orderIDEx': forAll ? 0 : orderIDEx
		}
	});
};
/**
 * 保活心跳
 * @param {type} m
 * @returns {undefined}
 */
_this.task[1004] = function(m) {
	_this._send({
		"aid": "peek_message"
	});
	return _this.post(m, {
		's2c': {
			'time': time()
		}
	});
};
/**
 * 账户资金
 * @param {type} m
 * @returns {undefined}
 */
_this.task[2101] = function(m) {
	if (empty(_this.funds[_this.uid])) {
		return _this.post(m, {
			'retType': -1,
			'retMsg': '未经初始化!'
		});
	}
	if (empty(m.c2s)) {
		return _this.post(m, {
			'retType': -1,
			'retMsg': '错误的包体!'
		});
	}
	let s2c = {
		funds: _this.funds[_this.uid]
	};
	return _this.post(m, {
		s2c: s2c
	});
};
/**
 * 限制频率(只是仿真,刷新页面就能跳过) 大陆期货6次/秒,没见明文公告,约定俗成?!
 * @param {type} proto
 * @param {type} sec
 * @param {type} cnt
 * @param {type} delay
 * @returns {Boolean}
 */
_this.limit = function(proto, sec, cnt, delay) {
	let ago;
	sec *= 1000;
	delay *= 1000;
	let now = _this.performance.now();
	if (typeof(_this.qq[proto]) == 'undefined') {
		_this.qq[proto] = new Array();
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
	return array_push(_this.qq[proto], now) <= cnt ? true : true; //天勤不需要限频
};
/**
 * 返回数据至上一级
 * @param {type} m
 * @param {type} s2c
 * @returns {undefined}
 */
_this.post = function(m, s2c) {
	_this.postMessage([array_replace_recursive({
		name: _this.name,
		proto: intval(m.proto),
		serialNo: intval(m.serialNo),
		s2c: {
			wk: 1
		},
		retMsg: '',
		retType: 0,
		errCode: 0
	}, s2c), _this.name]);
};
/**
 * 接收上一级数据
 */
_this.addEventListener('message', function(e) {
	_this.task[e.data['proto']](e.data);
}, false);