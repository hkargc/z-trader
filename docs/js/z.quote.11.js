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
_this.importScripts("./dexie.min.js");
_this.importScripts("./jose.umd.min.js");
_this.importScripts("./papaparse.min.js");
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
	ready: false, //数据是否准备妥当
	isAnonymous: empty(config.quote[11]["tqsdk_proxy"]) //是否匿名
};
_this.uid = 1;
_this.kvs = {}; //key-value-storage
_this.db = null; //Dexie存储器
_this.wss = {};
_this.NEW = {}; //服务端返回的最新数据合并而成的截面
_this.task = new Array();
_this.ISSYSTEM = false; //该连接是否包含资讯推送
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
	if (Q.isAnonymous) {
		Q.access_token = 'MDSESSION';
		return get_md_url();
	}
	let key = implode('-', ['access_token', md5(config.quote[11]["shinnytech_username"] + "@@@:@@@" + config.quote[11]["shinnytech_password"])]);
	if (_this.kvs[key]) {
		Q.access_token = _this.kvs[key];
		return get_md_url();
	}
	return _this.fetch(config.quote[11]["tqsdk_proxy"], {
		method: "POST",
		headers: {
			'Accept': 'application/json'
		},
		body: json_encode({
			"method": "POST",
			"json": false, //是否json表单application/json,否则为标准表单application/x-www-form-urlencoded
			"uri": "https://auth.shinnytech.com/auth/realms/shinnytech/protocol/openid-connect/token",
			"headers": get_headers(),
			"data": {
				"username": config.quote[11]["shinnytech_username"],
				"password": config.quote[11]["shinnytech_password"],
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
			//let claims = jose.decodeJwt(Q.access_token);
			//console.log(claims)
			return _this.db.table("z-kvs").put({
				type: 11,
				key: key,
				value: Q.access_token,
				expire: time() + 1 * 60 * 60
			});
		}
		console.log(m); //有可能账户或密码错误
	}).catch(function(e) {
		console.log(e);
	}).finally(function() {
		return get_md_url();
	});
}
/**
 * EDB Data Services 这个服务也有获取token的接口,但这个token无法连接交易服务
 * @returns
 */
function get_auth_token2() {
	let key = implode('-', ['access_token', md5(config.quote[11]["shinnytech_username"] + "@@@:@@@" + config.quote[11]["shinnytech_password"])]);
	if (_this.kvs[key]) {
		Q.access_token = _this.kvs[key];
		return get_md_url();
	}
	return _this.fetch(config.quote[11]["tqsdk_proxy"], {
		method: "POST",
		headers: {
			'Accept': 'application/json'
		},
		body: json_encode({
			"method": "POST",
			"json": true, //是否json表单application/json,否则为标准表单application/x-www-form-urlencoded
			"uri": "https://edb.shinnytech.com/token",
			"headers": get_headers(),
			"data": {
				"username": config.quote[11]["shinnytech_username"],
				"password": config.quote[11]["shinnytech_password"]
			}
		})
	}).then(function(response) {
		if (response.status == 200) {
			return response.json();
		}
	}).then(function(m) {
		if (m && m.token) {
			Q.access_token = m.token;
			return _this.db.table("z-kvs").put({
				type: 11,
				key: key,
				value: Q.access_token,
				expire: time() + 1 * 60 * 60
			});
		}
		console.log(m); //有可能账户或密码错误
	}).catch(function(e) {
		//console.log(e);
	}).finally(function() {
		get_md_url();
	});
}
/**
 * 授权信息[得到VIP账户的过期时间,没什么用,跳过]
 * @returns
 */
function get_auth_grant() {
	return _this.fetch(config.quote[11]["tqsdk_proxy"], {
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
	if (Q.isAnonymous) {
		Q.mdurl = "wss://free-api.shinnytech.com/t/nfmd/front/mobile";
		return _this._open();
	}
	let stock = 'true'; //注意这里必须是小写字符串
	let backtest = 'false'; //是否复盘服务器
	let key = implode('-', ['mdurl', stock, backtest]); //两个参数唯一确定一条地址
	if (_this.kvs[key]) {
		Q.mdurl = _this.kvs[key];
		return _this._open();
	}
	return _this.fetch(config.quote[11]["tqsdk_proxy"], {
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
	let key = implode('-', ['tdurl', md5(config.quote[11]["broker_bid"])]);
	if (_this.kvs[key]) {
		Q.tdurl = _this.kvs[key];
		return _this._open();
	}
	return _this.fetch(config.quote[11]["tqsdk_proxy"], {
		method: "POST",
		headers: {
			'Accept': 'application/json'
		},
		body: json_encode({
			"method": "GET",
			"uri": "https://files.shinnytech.com/" + config.quote[11]["broker_bid"] + ".json",
			"headers": get_headers(),
			"data": {
				"account_id": config.quote[11]["broker_account_id"],
				"auth": config.quote[11]["shinnytech_username"]
			}
		})
	}).then(function(response) {
		if (response.status == 200) {
			return response.json();
		}
	}).then(function(m) {
		if (m && m[config.quote[11]["broker_bid"]]) {
			if (in_array('TQ', m[config.quote[11]["broker_bid"]]['category'])) {
				Q.tdurl = m[config.quote[11]["broker_bid"]]['url'];
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
		_this._open();
	});
}
/**
 * 获取结算价 get_settlement_data(["DCE.v2605", "SHFE.rb2605"], 10, strtotime("20260301"))
 * @param {type} symbols  一个数组
 * @param {type} days 取多少天
 * @param {type} start_date 起始时间戳 
 * @returns {undefined}
 */
function get_settlement_data(symbols, days, start_date) {
	return _this.fetch(config.quote[11]["tqsdk_proxy"], {
		method: "POST",
		headers: {
			'Accept': 'application/json'
		},
		body: json_encode({
			"method": "GET",
			"uri": "https://md-settlement-system-fc-api.shinnytech.com/mss",
			"headers": get_headers(),
			"data": {
				"symbols": implode(",", symbols),
				"days": days,
				"start_date": date("Ymd", start_date)
			}
		})
	}).then(function(response) {
		if (response.status == 200) {
			return response.json();
		}
	}).then(function(m) {
		console.log(m);
	}).catch(function(e) {
		//console.log(e);
	}).finally(function() {});
}
_this._send = function(pack) {
	if (_this.wss.readyState == WebSocket.OPEN) {
		_this.wss.send(json_encode(pack));
	}
};
_this._open = function() {
	if (empty(Q.mdurl)) {
		return _this.post({
			proto: 1001,
			serialNo: 0
		}, {
			'retType': -1,
			'retMsg': '无行情地址!'
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
	if (Q.access_token.indexOf('.') !== -1) { //jwt
		let claims = jose.decodeJwt(Q.access_token);
		Q.grants = array_merge({}, claims["grants"]);
	}
	_this.wss = new WebSocket(Q.isAnonymous ? Q.mdurl : config.quote[11]["tqsdk_proxy"]);
	_this.wss.addEventListener('open', function(e) {
		Q.isAnonymous || _this._send({
			proto: 1001,
			c2s: {
				"uri": _this.Q.mdurl,
				"headers": get_headers()
			}
		});
	});
	_this.wss.addEventListener('message', function(e) {
		_this._send({ //这个机制起到流量控制的作用:服务端收到它后即刻推送累积更新,如果客户端处理不过来,可以延迟发这个指令
			"aid": "peek_message"
		});
		let diff = {}; //此次合计更新了哪些片段
		let m = json_decode(e.data);
		if (m.aid == 'rsp_login') { //登录成功响应[aid 字段不是 rtn_data 或 peek_message 则表示该包为一个指令包]
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
		_this.NEW = array_replace_recursive(_this.NEW, diff); //合并到主干
		if (diff["insserve_ready"]) { //行情连接OK
			_this.post({
				proto: 1001,
				serialNo: 0
			}, {
				s2c: {
					connID: 1,
					loginUserID: _this.uid,
					keepAliveInterval: 10
				}
			});
		}
		if (diff["notify"]) {
			for (let k in _this.NEW["notify"]) {
				let a = _this.NEW["notify"][k];
				delete _this.NEW["notify"][k];

				let ISSYSTEM = in_array(a.level, ['SYSTEM']) ? true : false; //是否资讯推送
				ISSYSTEM && (_this.ISSYSTEM = ISSYSTEM);
				ISSYSTEM || console.log(structuredClone(a));
				_this.post({ //模拟后端推送消息
					proto: 1003,
					serialNo: 0
				}, {
					s2c: {
						type: ISSYSTEM ? -1 : -2,
						event: {
							eventType: ISSYSTEM ? -1 : -2,
							desc: ISSYSTEM ? a['content'] : json_encode({
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
		if (diff["ticks"]) { //逐笔推送
			let ready = true;
			for (let chart_id in NEW.charts) { //确保所有订阅全部完成
				if (empty(NEW.charts[chart_id]["ready"])) {
					ready = false;
				}
			}
			if (ready) {
				for (let symbol in NEW.ticks) {
					let tickerList = [];
					let last_id = NEW.ticks[symbol]["last_id"];
					for (let j = 0;; last_id--, j++) {
						let a = NEW.ticks[symbol]["data"][last_id - 0]; //最新一条
						let b = NEW.ticks[symbol]["data"][last_id - 1]; //前一条
						if (j >= 1) { //只需保留最后一根用于下一次计算
							delete NEW.ticks[symbol]["data"][last_id];
						}
						if (empty(b) || empty(a)) {
							break;
						}
						let dir = 3; //以买一价与卖一价之间的价格撮合成交
						if (a["last_price"] <= a["bid_price1"]) { //以买一价或更低的价格成交
							dir = 2;
						}
						if (a["last_price"] >= a["ask_price1"]) { //以卖一价或更高的价格成交
							dir = 1;
						}
						let tick = {
							sequence: last_id,
							dir: dir,
							price: floatval(a["last_price"]),
							volume: intval(a["volume"] - b["volume"]),
							turnover: floatval(a["amount"] - b["amount"]),
							type: 1,
							timestamp: intval(a["datetime"] / 1000 / 1000 / 1000)
						};
						if (tick.volume && tick.price) { //这两个字段必须
							array_unshift(tickerList, tick);
						}
					}
					empty(tickerList) || _this.post({
						'proto': 3011
					}, {
						's2c': {
							security: {
								code: symbol
							},
							tickerList: tickerList
						}
					});
				}
			}
		}
		if (diff["klines"]) { //K线推送
			let ready = true;
			for (let chart_id in NEW.charts) { //确保所有订阅全部完成
				if (empty(NEW.charts[chart_id]["ready"])) {
					ready = false;
				}
			}
			if (ready) {
				for (let symbol in NEW.klines) {
					for (let duration in NEW.klines[symbol]) {
						let klList = [];
						let klines = NEW.klines[symbol][duration]["data"];
						for (let i in klines) {
							let a = klines[i];
							klList.push({
								timestamp: a['datetime'] / 1000000000,
								openPrice: round(a['open'], 1),
								highPrice: round(a['high'], 1),
								lowPrice: round(a['low'], 1),
								closePrice: round(a['close'], 1),
								volume: a['volume'],
								turnover: a['volume'] * a['close'],
								turnoverRate: 0
							});
						}
						delete NEW.klines[symbol][duration]["data"]; //这个数组太大
						if (Q.ready) { //K线更新
							_this.post({
								'proto': 3007
							}, {
								's2c': {
									security: {
										code: symbol
									},
									klList: klList
								}
							});
						} else { //K线初始化
							_this.post({
								'proto': 3103
							}, {
								's2c': {
									security: {
										code: symbol
									},
									klList: klList
								}
							});
							_this.post({ //模拟后端推送消息
								proto: 1003,
								serialNo: 0
							}, {
								s2c: {
									type: -1,
									event: {
										eventType: -1,
										desc: json_encode({
											"desc": "",
											"news": [],
											"gaps": [],
											"events": []
										})
									}
								}
							});
						}
					}
				}
				Q.ready = true; //标志初始化完毕
			}
		}
		if (diff["quotes"]) { //实时行情和合约信息
			for (let symbol in NEW.quotes) {
				let a = NEW.quotes[symbol];
				if(empty(a)){
					continue;
				}
				let t = strtotime(a["datetime"]); //从交易所收到数据的时间
				let s2c = {
					security: {
						code: symbol
					},
					svrRecvTimeBidTimestamp: t,
					svrRecvTimeAskTimestamp: t,
					orderBookBidList: {},
					orderBookAskList: {}
				};
				for (let i = 1; i <= 10; i++) {
					if (empty(a['bid_price' + i]) || empty(a['ask_price' + i])) { //说明没有这些档位
						continue;
					}
					s2c['orderBookBidList'][i - 1] = {
						'price': floatval(a['bid_price' + i]),
						'volume': intval(a['bid_volume' + i])
					};
					s2c['orderBookAskList'][i - 1] = {
						'price': floatval(a['ask_price' + i]),
						'volume': intval(a['ask_volume' + i])
					};
				}
				_this.post({
					'proto': 3013
				}, { //相当于富途的摆盘推送
					's2c': s2c
				});
				_this.post({
					'proto': 3005
				}, { //相当于富途的实时报价推送[新增涨跌停价字段]
					's2c': {
						basicQotList: [{
							security: {
								code: symbol
							},
							updateTimestamp: t,
							volume: intval(a["volume"]),
							turnover: floatval(a["amount"]),
							curPrice: floatval(a["last_price"]),
							openPrice: floatval(a["open"]),
							lowPrice: floatval(a["lowest"]),
							highPrice: floatval(a["highest"]), //最高价
							lastClosePrice: floatval(a["pre_close"]),
							upper_limit: floatval(a["upper_limit"]), //涨跌停价不兼容富途
							lower_limit: floatval(a["lower_limit"])
						}]
					}
				});
			}
		}
		if (diff["symbols"] && NEW.symbols) { //GraphQL查询结果
			for (let query_id in NEW.symbols) {
				let a = NEW.symbols[query_id];
				delete NEW.symbols[query_id];
				if (empty(a) || empty(a["result"]) || empty(a["result"]["multi_symbol_info"])) {
					for(let i in a["errors"]){
						a["errors"][i] && a["errors"][i]["message"] && _this.post({ //错误消息
							proto: 1003,
							serialNo: 0
						}, {
							s2c: {
								type: -2,
								event: {
									eventType: -2,
									desc: json_encode({
										"desc": a["errors"][i]["message"],
										"news": [],
										"gaps": [],
										"events": []
									})
								}
							}
						});
					}
					continue;
				}
				let [prefix, proto, hash] = explode('_', query_id); //提取...
				proto = intval(proto);

				let symbols = [];
				let futureInfoList = [];
				let expire = mktime(24, 0, 0) + 21 * 60 * 60; //明天晚上9点过期
				for (let i in a["result"]["multi_symbol_info"]) {
					let b = a["result"]["multi_symbol_info"][i];
					let c = b['underlying'] && b['underlying']['edges'] && b['underlying']['edges'][0] && b['underlying']['edges'][0]['node'] ? b['underlying']['edges'][0]['node'] : {};
					let futureInfo = {
						name: b["instrument_name"],
						minVar: c["price_tick"] || b["price_tick"], //最小变动单位,JS的||与PHP的不一样
						contractSize: c["volume_multiple"] || b["volume_multiple"], //合约规模[合约乘数]
						lower_limit: c["lower_limit"] || b["lower_limit"], //跌停板
						upper_limit: c["upper_limit"] || b["upper_limit"], //涨停板
						security: { //原始查询
							code: b["instrument_id"]
						},
						origin: { //origin_code 实际合约代码 用于下单
							code: c["instrument_id"] || b["instrument_id"]
						}
					};
					if (in_array(b["exchange_id"], ['KQ', 'KQD'])) { //主连
						futureInfo["owner"] = {
							code: b["instrument_id"]
						};
						if (empty(c)) { //是主连但没有实际合约[比如海外期货]
							delete futureInfo["origin"];
						}
					}
					futureInfoList.push(futureInfo);

					b["node"] = c;
					b["expire"] = expire;
					delete b['underlying'];
					symbols.push(b);

				}
				if (in_array(proto, [3202], true) && symbols.length) {
					_this.db.table("z-symbols").bulkPut(symbols);

					_this.post({
						proto: proto
					}, {
						s2c: {
							symbols: symbols
						}
					});
				}
				if (in_array(proto, [3218], true) && futureInfoList.length) {
					_this.post({
						proto: proto
					}, {
						's2c': {
							'futureInfoList': futureInfoList
						}
					});
				}
			}
		}
		if (diff["mdhis_more_data"] && empty(NEW.mdhis_more_data)) { //md行情,td交易,改成 md has_more_data 比较好理解:是否还有更多行情数据,比如取10000根K线,会分几次发送,第一次发送的包会把这个值设为true,最后一次设为false
			//所需数据已经完整发完,本项目采用charts里面的ready字段
			//console.log(NEW.mdhis_more_data)
		}
		//console.log(NEW)
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
 * 保活心跳
 * @param {type} m
 * @returns {undefined}
 */
_this.task[1004] = function(m) {
	if (empty(m.c2s)) {
		return _this.post(m, {
			'retType': -1,
			'retMsg': '错误的包体!'
		});
	}
	_this._send({
		"aid": "peek_message"
	});
	_this.ISSYSTEM || _this.post({ //模拟后端推送消息
		proto: 1003,
		serialNo: 0
	}, {
		s2c: {
			type: -1,
			event: {
				eventType: -1,
				desc: json_encode({
					"desc": "",
					"news": [],
					"gaps": [],
					"events": []
				})
			}
		}
	});
	return _this.post(m, {
		's2c': {
			'time': time()
		}
	});
};
/**
 * 获取静态数据
 * @param {type} m
 * @returns {undefined}
 */
_this.task[3202] = function(m) {
	if (empty(m.c2s)) {
		return _this.post(m, {
			'retType': -1,
			'retMsg': '错误的包体!'
		});
	}
	if (m.c2s.secType == 10) { //获取所有期货
		let now = time();
		let exist = true;
		let symbols = [];
		return _this.db.table("z-symbols").each(function(a) {
			if (a.expire <= now) { //只要有一个过期就停止
				symbols = [];
				exist = false;
				return false;
			}
			symbols.push(a);
		}).then(function() {
			symbols.length && _this.post(m, {
				s2c: {
					symbols: symbols
				}
			});
			symbols.length || _this.db.table("z-symbols").clear().then(function() {
				ins_query(m.proto, { //这里发出一个GraphQL查询包,在message里面响应
					"class": ["FUTURE", "CONT"],
					"exchange_id": ["CFFEX", "SHFE", "DCE", "CZCE", "INE", "GFEX", "KQ", "KQD"],
					"expired": false
				});
			});
		}).catch(function(e) {

		});
	}
	if (empty(m.c2s.securityList)) {
		return _this.post(m, {
			'retType': -1,
			'retMsg': '缺少标的物!'
		});
	}
	let staticInfoList = {};
	for (let i in m.c2s.securityList) {
		let security = m.c2s.securityList[i];
		staticInfoList[i] = {
			basic: {
				security: security,
				lotSize: 1,
				secType: 10, //当前只支持大陆期货
				name: security['code'],
				delisting: 0, //是否退市状态,必须为0
				exchType: 101 //交易所,不会入库,大于0的值就行 101天勤
			}
		};
	}
	return _this.post(m, {
		s2c: {
			staticInfoList: staticInfoList
		}
	});
};
/**
 * 获取期货合约资料
 * @param {type} m
 * @returns {undefined}
 */
_this.task[3218] = function(m) {
	if (empty(m.c2s)) {
		return _this.post(m, {
			'retType': -1,
			'retMsg': '错误的包体!'
		});
	}
	if (empty(m.c2s.securityList)) {
		return _this.post(m, {
			'retType': -1,
			'retMsg': '缺少标的物!'
		});
	}
	let instrument_id = [];
	for (let i in m.c2s.securityList) {
		let security = m.c2s.securityList[i];
		instrument_id.push(security['code']);
	}
	ins_query(m.proto, { //这里发出一个GraphQL查询包,在message里面响应
		instrument_id: instrument_id
	});
};
/**
 * 查询交易日期.假期数据来源: https://files.shinnytech.com/shinny_chinese_holiday.json
 * @param {type} m
 * @returns {undefined}
 */
_this.task[3219] = function(m) {
	if (empty(m.c2s)) {
		return _this.post(m, {
			'retType': -1,
			'retMsg': '错误的包体!'
		});
	}
	if (empty(m.c2s.beginTime)) {
		return _this.post(m, {
			'retType': -1,
			'retMsg': '无起始时间!'
		});
	}
	if (empty(m.c2s.endTime)) {
		return _this.post(m, {
			'retType': -1,
			'retMsg': '无结束时间!'
		});
	}
	let HOLIDAYS = [1454860800,
		1454947200,
		1455033600,
		1455120000,
		1455206400,
		1459699200,
		1462118400,
		1465401600,
		1465488000,
		1473868800,
		1473955200,
		1475424000,
		1475510400,
		1475596800,
		1475683200,
		1475769600,
		1483286400,
		1485446400,
		1485705600,
		1485792000,
		1485878400,
		1485964800,
		1491148800,
		1491235200,
		1493568000,
		1495987200,
		1496073600,
		1506873600,
		1506960000,
		1507046400,
		1507132800,
		1507219200,
		1514736000,
		1518624000,
		1518710400,
		1518969600,
		1519056000,
		1519142400,
		1522857600,
		1522944000,
		1525017600,
		1525104000,
		1529251200,
		1537718400,
		1538323200,
		1538409600,
		1538496000,
		1538582400,
		1538668800,
		1546185600,
		1546272000,
		1549209600,
		1549296000,
		1549382400,
		1549468800,
		1549555200,
		1554393600,
		1556640000,
		1556726400,
		1556812800,
		1559836800,
		1568304000,
		1569859200,
		1569945600,
		1570032000,
		1570118400,
		1570377600,
		1577808000,
		1579795200,
		1580054400,
		1580140800,
		1580227200,
		1580313600,
		1580400000,
		1586102400,
		1588262400,
		1588521600,
		1588608000,
		1593014400,
		1593100800,
		1601481600,
		1601568000,
		1601827200,
		1601913600,
		1602000000,
		1602086400,
		1609430400,
		1612972800,
		1613059200,
		1613318400,
		1613404800,
		1613491200,
		1617552000,
		1619971200,
		1620057600,
		1620144000,
		1623600000,
		1632067200,
		1632153600,
		1633017600,
		1633276800,
		1633363200,
		1633449600,
		1633536000,
		1641139200,
		1643558400,
		1643644800,
		1643731200,
		1643817600,
		1643904000,
		1649001600,
		1649088000,
		1651420800,
		1651507200,
		1651593600,
		1654185600,
		1662912000,
		1664726400,
		1664812800,
		1664899200,
		1664985600,
		1665072000,
		1672588800,
		1674403200,
		1674489600,
		1674576000,
		1674662400,
		1674748800,
		1680624000,
		1682870400,
		1682956800,
		1683043200,
		1687363200,
		1687449600,
		1695916800,
		1696176000,
		1696262400,
		1696348800,
		1696435200,
		1696521600,
		1704038400,
		1707408000,
		1707667200,
		1707753600,
		1707840000,
		1707926400,
		1708012800,
		1712160000,
		1712246400,
		1714492800,
		1714579200,
		1714665600,
		1717948800,
		1726416000,
		1726502400,
		1727712000,
		1727798400,
		1727884800,
		1727971200,
		1728230400,
		1735660800,
		1737993600,
		1738080000,
		1738166400,
		1738252800,
		1738512000,
		1738598400,
		1743696000,
		1746028800,
		1746115200,
		1746374400,
		1748793600,
		1759248000,
		1759334400,
		1759420800,
		1759680000,
		1759766400,
		1759852800,
		1767196800,
		1767283200,
		1771171200,
		1771257600,
		1771344000,
		1771430400,
		1771516800,
		1771776000,
		1775404800,
		1777564800,
		1777824000,
		1777910400,
		1781798400,
		1790265600,
		1790784000,
		1790870400,
		1791129600,
		1791216000,
		1791302400
	];
	let beginTime = strtotime(m.c2s.beginTime) * 1;
	let endTime = strtotime(m.c2s.endTime) * 1;
	let zero = min(beginTime, endTime);
	let week = date('w', zero) * 1; //今天周几,0为周日
	let tradeDateList = [];
	for (let i = 0;; i++) {
		let w = (week + i) % 7;
		if (w == 0) {
			continue;
		}
		if (w == 6) {
			continue;
		}
		let timestamp = zero + i * 24 * 60 * 60;
		if (timestamp > endTime) {
			break;
		}
		if (in_array(timestamp, HOLIDAYS)) {
			continue;
		}
		tradeDateList.push({
			timestamp: timestamp
		});
	}
	return _this.post(m, {
		's2c': {
			tradeDateList: tradeDateList
		}
	});
};
/**
 * 获取历史K线.天勤支持任意周期[需要调整此处和上层逻辑].暂时兼容富途.暂时只支持一个图表只能调用一次
 * @param {type} m
 * @returns {undefined}
 */
_this.task[3103] = function(m) {
	if (empty(m.c2s)) {
		return _this.post(m, {
			'retType': -1,
			'retMsg': '错误的包体!'
		});
	}
	if (empty(m.c2s.security)) {
		return _this.post(m, {
			'retType': -1,
			'retMsg': '没有标的物!'
		});
	}
	let code = m.c2s.security.code;
	let klType = m.c2s.klType;
	let beginTime = strtotime(m.c2s.beginTime);
	let endTime = strtotime(m.c2s.endTime);
	let rehabType = m.c2s.rehabType;
	if (empty(KL2SUB[klType])) {
		return _this.post(m, {
			'retType': -1,
			'retMsg': '不支持的周期!'
		});
	}
	if (in_array(klType, [1]) && empty(Q.isAnonymous) && (endTime <= mktime(0, 0, 0))) { //免费版支持一年内的一分K https://doc.shinnytech.com/edb/latest/index.html
		return _this.fetch(config.quote[11]["tqsdk_proxy"], {
			method: "POST",
			headers: {
				'Accept': 'application/json'
			},
			body: json_encode({
				"method": "GET",
				"json": false, //是否json表单application/json,否则为标准表单application/x-www-form-urlencoded
				"uri": "https://edb.shinnytech.com/md/kline",
				"headers": get_headers(),
				"data": {
					"period": 60,
					"symbol": code,
					"start_time": date("Y-m-d H:i:s", beginTime),
					"end_time": date("Y-m-d H:i:s", endTime)
				}
			})
		}).then(function(response) {
			let status = response.status;
			return response.text().then(function(body) {
				return [status, body];
			});
		}).then(function([status, body]) {
			if (status != 200) {
				return console.log(body);
			}
			let klList = [];
			Papa.parse(body, {
				header: true, //将第一行作为对象键名
				dynamicTyping: true, //自动将数字/布尔值转换为对应类型
				skipEmptyLines: "greedy", //跳过空行或只有空白字符的行
				step: function(results, parser) {
					let a = results.data;
					klList.push({
						timestamp: a['datetime_nano'] / 1000000000,
						openPrice: round(a['open'], 1),
						highPrice: round(a['high'], 1),
						lowPrice: round(a['low'], 1),
						closePrice: round(a['close'], 1),
						volume: a['volume'],
						turnover: a['volume'] * a['close'],
						turnoverRate: 0
					});
				},
				complete: function(results) {
					_this.post({
						'proto': 3103
					}, {
						's2c': {
							security: {
								code: code
							},
							klList: klList
						}
					});
				}
			});
		}).catch(function(e) {
			//console.log(e)
		}).finally(function() {});
	}
	for (let chart_id in NEW.charts) { //确保只调用一次
		if (strpos(chart_id, "PYSDK_realtime_0") !== false) {
			return _this.post(m, {
				'retType': -1,
				'retMsg': '只能一个图!'
			});
		}
	}
	_this._send({ //支持多个的暂时搞一个
		"aid": "set_chart",
		'chart_id': 'PYSDK_realtime_0' + substr(md5(mt_rand()), 0, -1),
		'ins_list': implode(",", [code]), //填空表示删除该图表
		'duration': array_last(KL2SUB[klType]) * 60 * 1000 * 1000 * 1000,
		'view_width': 10000
	});
};
/**
 * 订阅实时数据
 * @param {type} m
 * @returns {undefined}
 */
_this.task[3001] = function(m) {
	if (empty(m.c2s)) {
		return _this.post(m, {
			'retType': -1,
			'retMsg': '错误的包体!'
		});
	}
	if (empty(m.c2s.securityList)) {
		return _this.post(m, {
			'retType': -1,
			'retMsg': '错误的包体!'
		});
	}
	let ins_list = NEW.ins_list ? explode(",", NEW.ins_list) : []; //全量订阅
	for (let i in m.c2s.securityList) {
		ins_list.push(m.c2s.securityList[i]["code"]);
	}
	ins_list = array_unique(ins_list);
	_this._send({ //订阅盘口实时数据.支持多个
		"aid": "subscribe_quote",
		"ins_list": implode(",", ins_list)
	});
	let chart_id = 'PYSDK_realtime_1' + substr(md5(mt_rand()), 0, -1);
	for (let id in NEW.charts) { //覆盖上一个chart
		if (strpos(id, "PYSDK_realtime_1") !== false) {
			chart_id = id;
		}
	}
	_this._send({ //订阅Tick.支持多个
		"aid": "set_chart",
		'chart_id': chart_id,
		'ins_list': implode(",", ins_list),
		'duration': 0, //为0是订阅Tick
		'view_width': 2
	});
	return _this.post(m, {
		's2c': {}
	});
};
/**
 * 获取快照信息[兼容]
 * @param {type} m
 * @returns {undefined}
 */
_this.task[3203] = function(m) {
	if (empty(m.c2s)) {
		return _this.post(m, {
			'retType': -1,
			'retMsg': '错误的包体!'
		});
	}
	if (empty(m.c2s.securityList)) {
		return _this.post(m, {
			'retType': -1,
			'retMsg': '缺少标的物!'
		});
	}
	let snapshotList = {};
	for (let i in m.c2s.securityList) {
		let security = m.c2s.securityList[i];
		snapshotList[i] = {
			basic: {
				security: security
			}
		};
	}
	return _this.post(m, {
		's2c': {
			snapshotList: snapshotList
		}
	});
};
/**
 * 获取牛熊证[兼容]
 * @param {type} m
 * @returns {undefined}
 */
_this.task[3210] = function(m) {
	return _this.post(m, {
		's2c': {
			warrantDataList: [],
			lastPage: true,
			allCount: 0
		}
	});
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
			wk: 0
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
	let m = e.data;
	_this.task[m['proto']](m);
}, false);
/**
 * 执行一个GraphQL查询.此接口发出查询,由message事件接收结果
 * 改编自TQSDK,字段定义在 ins_schema.py 里面,可查字段由rootQuery定义
 * @returns {undefined}
 */
function ins_query(proto, params) {
	let query_id = `PYSDK_${proto}_${md5(mt_rand())}`; //不清楚服务端会不会对这个值进行分析进而触发流控
	let variables = array_merge({
		"class": [], //数组 'BOND':债券 'COMBINE':组合 'CONT':主连 'FUND':基金 'FUTURE':期货 'INDEX':指数 'OPTION':期权 'SPOT':现货 'STOCK':股票
		"exchange_id": [], //交易所代码 KQ:快期[所有主连都属于KQ] KQD:外盘主连[延时15分钟,class为FUTURE] CFFEX:中金所 SHFE:上期所 DCE:大商所 CZCE:郑商所 INE:能源交易所 SSE:上交所 SZSE:深交所 GFEX:广期所
		"instrument_id": [], //合约代码
		"product_id": [], //指定品种 如螺纹、铁矿石
		"categories": [], //所属板块 'AGRICULTURAL', 'CHEMICAL', 'COAL', 'EQUITY_INDEX', 'FERROUS', 'GRAIN', 'GREASE', 'LIGHT_INDUSTRY', 'NONFERROUS_METALS', 'OIL', 'PRECIOUS_METALS', 'SOFT_COMMODITY', 'TREASURY_BOND'
		"expired": false, //是否已到期
		"has_night": null, //是否有夜盘
		"has_derivatives": null, //是否有衍生品
		"timestamp": 0 //回测时间点
	}, params);
	/**
	let params = { //这份配置是获取大陆期货主连及对应标的资料
		"class": ["CONT"],
		"exchange_id": ['KQ'],
		"expired": false
	};
	
	let params = { //这份配置是获取海外期货主连代码[没有提供对应标的资料]
		"class": ["FUTURE"],
		"exchange_id": ['KQD'],
		"expired": false
	};
	
	let params = { //这份配置是获取所有线上可交易期货
		"class": ["FUTURE"],
		"exchange_id": ["CFFEX", "SHFE", "DCE", "CZCE", "INE", "GFEX"],
		"expired": false
	};
	**/
	let headArray = [];
	let bodyArray = [];
	for (let key in variables) { //按需填单,否则排错比较棘手[相当于防SQL注入] 不厌其烦!!!
		if (in_array(key, ["instrument_id", "exchange_id", "product_id", "class", "categories"]) && is_array(variables[key]) && count(variables[key])) { //数组+非空
			for (let k in variables[key]) {
				variables[key][k] = trim(variables[key][k]);
				if (empty(variables[key][k])) { //字符串+非空
					delete variables[key][k];
				}
			}
			variables[key] = array_values(variables[key] ?? []); //重组
			if (empty(variables[key])) { //为空的要删除
				delete variables[key];
			} else {
				let type = "String";
				if (in_array(key, ["class"])) {
					type = "Class";
				}
				if (in_array(key, ["categories"])) {
					type = "Category";
				}
				headArray.push(`$${key}:[${type}]`);
				bodyArray.push(`${key}:$${key}`);
			}
		} else if (in_array(key, ["expired", "has_night", "has_derivatives"]) && is_bool(variables[key])) {
			headArray.push(`$${key}:Boolean`);
			bodyArray.push(`${key}:$${key}`);
		} else if (in_array(key, ["timestamp"]) && is_int(variables[key]) && variables[key]) {
			headArray.push(`$${key}:Int64`);
			bodyArray.push(`${key}:$${key}`);
		} else { //非查询字段范围
			delete variables[key];
		}
	}
	if (empty(headArray) || empty(bodyArray)) { //禁止全量查询
		return false;
	}
	let queryHead = "(" + implode(',', headArray) + ")";
	let queryBody = "(" + implode(',', bodyArray) + ")";
	let query = `
        query${queryHead}{
            multi_symbol_info${queryBody}{
				... on basic {
					#instrument_name_wh
					price_decs
					price_tick
					#ins_id
					instrument_id
					exchange_id
					instrument_name
					trading_time {
						day
						night
					}
					class
					#py_wh
					#english_name
					trading_day
					#derivatives{
					#	count
					#	edges {
					#		underlying_multiple
					#		node { 
					#			... on basic { 
					#				instrument_id
					#			}
					#		}
					#	}
					#}
				}
				... on tradeable {
					upper_limit
					lower_limit
					volume_multiple
					quote_multiple
					pre_close
				}
				... on future {
					categories{
						id
						name
					}
					close_max_limit_order_volume
					close_max_market_order_volume
					close_min_limit_order_volume
					close_min_market_order_volume
					commission
					delivery_month
					delivery_year
					expire_datetime
					expired
					margin
					max_limit_order_volume
					max_market_order_volume
					min_limit_order_volume
					min_market_order_volume
					mmsa
					open_max_limit_order_volume
					open_max_market_order_volume
					open_min_limit_order_volume
					open_min_market_order_volume
					position_limit
					pre_open_interest
					pre_open_interest2
					product_id
					#product_short_name
					#product_short_name_wh
					settlement_price
				}
				... on derivative {
                    underlying {
                        edges {
                            node {
                                ... on basic {
                                    #instrument_name_wh
									price_decs
									price_tick
									#ins_id
									instrument_id
									exchange_id
									instrument_name
									trading_time {
										day
										night
									}
									class
									#py_wh
									#english_name
									trading_day
									#derivatives{
									#	count
									#	edges {
									#		underlying_multiple
									#		node { 
									#			... on basic { 
									#				instrument_id
									#			}
									#		}
									#	}
									#}
                                }
								... on tradeable {
									upper_limit
									lower_limit
									volume_multiple
									quote_multiple
									pre_close
								}
                                ... on future {
									categories{
										id
										name
									}
									close_max_limit_order_volume
									close_max_market_order_volume
									close_min_limit_order_volume
									close_min_market_order_volume
									commission
									delivery_month
									delivery_year
									expire_datetime
									expired
									margin
									max_limit_order_volume
									max_market_order_volume
									min_limit_order_volume
									min_market_order_volume
									mmsa
									open_max_limit_order_volume
									open_max_market_order_volume
									open_min_limit_order_volume
									open_min_market_order_volume
									position_limit
									pre_open_interest
									pre_open_interest2
									product_id
									#product_short_name
									#product_short_name_wh
									settlement_price
                                }
                            }
                        }
                    }
                }
            }
        }
    `;
	_this._send({
		aid: "ins_query",
		query_id: query_id,
		query: query,
		variables: variables
	});
}