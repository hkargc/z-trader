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
_this.importScripts("./dexie.min.js");
_this.importScripts("./locutus.min.js");
_this.importScripts("./common.js?_=" + Math.random());
_this.uid = 1;
_this.tmode = 0; //前端仿真成交模式trading mode:0无;1以实时报价进行成交[成交量不受控,只要价格到了就成交];2以买买盘和逐笔进行成交[最接近实战,但要求实时摆盘和实时逐笔];
_this.orderIDEx = 0; //自增长订单ID,当前时间为起点,累加
_this.orders = {}; //订单列表
_this.bookers = {}; //摆盘
_this.tickers = {}; //逐笔
_this.kvs = {}; //key-value-storage
_this.u2o = {}; //user to order 各账户下的订单
_this.w2o = {}; //waiting to order 未完成的订单
_this.c2o = {}; //code to order 各标的下的订单
_this.stocks = {}; //
_this.funds = {}; //账户资金
_this.positions = {}; //持仓
_this.db = null; //Dexie存储器
_this.qq = new Array(); //用于限频
function order(a, push) {
	if (empty(a['orderIDEx'])) {
		return [];
	}
	let b = _this.orders[a['orderIDEx']]; //如果没有初始化则为空数组
	let o = array_merge(b, a);
	if (empty(o['uid'])) {
		return [];
	}
	if (empty(o['code'])) {
		return [];
	}
	_this.orders[o['orderIDEx']] = o;
	if (empty(_this.u2o[o['uid']])) {
		_this.u2o[o['uid']] = {};
	}
	_this.u2o[o['uid']][o['orderIDEx']] = o['orderIDEx'];
	if (empty(_this.c2o[o['code']])) {
		_this.c2o[o['code']] = {};
	}
	_this.c2o[o['code']][o['orderIDEx']] = o['orderIDEx'];
	if (in_array(a['orderStatus'], [5, 10])) { //更改了状态为挂单
		if (empty(_this.w2o[o['code']])) {
			_this.w2o[o['code']] = {};
		}
		_this.w2o[o['code']][o['orderIDEx']] = o['orderIDEx'];
	}
	if (in_array(a['orderStatus'], [11, 14, 22])) { //订单已完成/完成部分剩余已撤单/暂停
		if (_this.w2o[o['code']]) {
			delete _this.w2o[o['code']][o['orderIDEx']];
			if (empty(_this.w2o[o['code']])) {
				delete _this.w2o[o['code']];
			}
		}
	}
	if ((a['f'] == 2) || in_array(a['orderStatus'], [15])) { //完全清仓或撤单
		delete _this.orders[o['orderIDEx']];
		delete _this.u2o[o['uid']][o['orderIDEx']];
		delete _this.c2o[o['code']][o['orderIDEx']];
		if (_this.w2o[o['code']]) {
			delete _this.w2o[o['code']][o['orderIDEx']];
			if (empty(_this.w2o[o['code']])) {
				delete _this.w2o[o['code']];
			}
		}
	}
	delete a['orderIDEx'];
	if (push && count(a)) { //更新了字段,数据落地
		_this.db.table("z-orders").put(o);
		if (in_array(o['orderStatus'], [5, 10])) { //生效
		}
		if (in_array(o['orderStatus'], [11, 14])) { //完成
		}
		if (in_array(o['orderStatus'], [15])) { //撤单
			_this.db.table("z-orders").where({
				orderIDEx: o['orderIDEx']
			}).delete().then(function() {});
		}
		if (in_array(o['orderStatus'], [22])) { //失效
		}
	}
	delete a['f'];
	delete a['volume'];
	if (push && (_this.uid == o['uid']) && count(a)) { //更新了除volume及f之外的字段,推送详情
		do_position(o['uid']); //重新计算资金
		_this.post({
			'proto': 2208
		}, {
			s2c: {
				'order': o
			}
		});
		if (in_array(o['orderStatus'], [11, 14])) { //完成则推送成交
			_this.post({
				'proto': 2218
			}, {
				s2c: {
					'orderFill': array_merge(o, {
						'fillIDEx': o['orderIDEx'],
						'price': o['fillAvgPrice'],
						'qty': o['fillQty']
					})
				}
			});
		}
	}
	return o;
};
/**
 * 针对每一支标的的所有订单进行处理
 * @param string code
 * @return boolean
 */
function do_stock(code) {
	let tickers = [];
	if (isset(_this.tickers[code])) { //把逐笔全部拿出
		tickers = _this.tickers[code];
		delete _this.tickers[code];
	}
	if (empty(_this.w2o[code])) {
		return false;
	}
	let msgs = {};
	let now = time();
	
	let o = _this.bookers[code]; //摆盘
	let fAsk = o && o['orderBookAskList'] ? array_first(o['orderBookAskList']) : false; //卖一 The first of orderBookAskList
	let lAsk = o && o['orderBookAskList'] ? array_last(o['orderBookAskList']) : false;
	let fBid = o && o['orderBookBidList'] ? array_first(o['orderBookBidList']) : false; //买一
	let lBid = o && o['orderBookBidList'] ? array_last(o['orderBookBidList']) : false;
	
	let stock = array_merge({
		curPrice: 0,
		updateTimestamp: now
	}, _this.stocks[code]);

	for (let orderIDEx in _this.w2o[code]) {
		orderIDEx = intval(orderIDEx);
		let a = _this.orders[orderIDEx];
		let b = []; //更改了哪些字段
		if (in_array(a['trdSide'], [1, 4])) { //开多,平空
			if (fAsk && (fAsk['price'] <= a['price']) && (o['svrRecvTime'] >= a['updateTimestamp'])) { //大于卖一,则从卖一开始逐档成交
				for (let i in o['orderBookAskList']) { //从卖一开始
					let Ask = o['orderBookAskList'][i];
					if (Ask['price'] > a['price']) {
						break;
					}
					Ask['volume'] = intval(l2s(Ask['volume']));
					let key = implode(':', ['Ask', a['uid'], a['code'], a['trdSide'], sprintf("%.3f", Ask['price'])]); //此人今天在这个价位成交了多少
					let fillQty = 0;
					if (fillQty = max(0, min(a['qty'] - a['fillQty'], Ask['volume'] - intval(_this.kvs[key])))) { //可以买的
						a['fillAvgPrice'] = b['fillAvgPrice'] = (a['fillAvgPrice'] * a['fillQty'] + Ask['price'] * fillQty) / (a['fillQty'] + fillQty);
						a['fillQty'] = b['fillQty'] = a['fillQty'] + fillQty;
						a['orderStatus'] = b['orderStatus'] = ((a['fillQty'] == a['qty']) ? 11 : 10);
						a['updateTimestamp'] = b['updateTimestamp'] = o['svrRecvTime'];
						_this.kvs[key] = intval(_this.kvs[key]) + fillQty;
						_this.db.table("z-kvs").put({
							type: 0,
							key: key,
							value: _this.kvs[key],
							expire: mktime(24, 0, 0)
						});
						if (empty(msgs[a['uid']])) {
							msgs[a['uid']] = [];
						}
						msgs[a['uid']].push({
							'code': a['code'],
							'secType': a['secType'],
							'createTimestamp': a['createTimestamp'],
							'msg': "成功" + (a['trdSide'] == 1 ? "开多" : "平空") + fillQty + "@" + a['price'] + "[" + a['name'] + "]"
						});
					}
					if (a['orderStatus'] == 11) {
						break;
					}
				}
			}
			if (in_array(a['orderStatus'], [5, 10]) && tickers.length) { //查逐笔
				for (let k in tickers) {
					let t = tickers[k];
					if (t['timestamp'] < a['updateTimestamp']) { //比订单还早的数据
						continue;
					}
					if (a['price'] < t['price']) {
						continue;
					}
					if (t[a['uid']]) { //该笔已经被该用户其他订单吃过
						continue;
					}
					tickers[k][a['uid']] = true;
					t['volume'] = intval(l2s(t['volume']));
					if (a['volume']) { //先得把买档吃掉
						let volume = max(0, a['volume'] - t['volume']);
						t['volume'] -= a['volume'];
						a['volume'] = b['volume'] = volume;
					}
					let fillQty = 0;
					if (fillQty = max(0, min(a['qty'] - a['fillQty'], t['volume']))) {
						a['fillAvgPrice'] = b['fillAvgPrice'] = (a['fillAvgPrice'] * a['fillQty'] + a['price'] * fillQty) / (a['fillQty'] + fillQty);
						a['fillQty'] = b['fillQty'] = a['fillQty'] + fillQty;
						a['orderStatus'] = b['orderStatus'] = ((a['fillQty'] == a['qty']) ? 11 : 10);
						a['updateTimestamp'] = b['updateTimestamp'] = t['timestamp']; //这里要改成逐笔发生的时间才妥当
						if (empty(msgs[a['uid']])) {
							msgs[a['uid']] = [];
						}
						msgs[a['uid']].push({
							'code': a['code'],
							'secType': a['secType'],
							'createTimestamp': a['createTimestamp'],
							'msg': "成功" + (a['trdSide'] == 1 ? "开多" : "平空") + fillQty + "@" + a['price'] + "[" + a['name'] + "]"
						});
					}
					if (a['orderStatus'] == 11) {
						break;
					}
				}
			}
			if (in_array(a['orderStatus'], [5, 10]) && fBid && lBid && (a['price'] <= fBid['price']) && (a['price'] >= lBid['price'])) { //查看摆盘是否有变化(排队)
				for (let i in o['orderBookBidList']) {
					let Bid = o['orderBookBidList'][i];
					if (a['price'] == Bid['price']) {
						Bid['volume'] = intval(l2s(Bid['volume']));
						if (is_null(a['volume']) || (a['volume'] > Bid['volume'])) {
							a['volume'] = b['volume'] = Bid['volume'];
						}
						break;
					}
				}
			}
			if ((_this.tmode == 1) && stock['curPrice'] && (stock['curPrice'] <= a['price']) && (stock['updateTimestamp'] > a['updateTimestamp'])) { //简单报价成交模式
				let fillQty = a['qty'];
				a['fillAvgPrice'] = b['fillAvgPrice'] = (a['fillAvgPrice'] * a['fillQty'] + stock['curPrice'] * fillQty) / (a['fillQty'] + fillQty);
				a['fillQty'] = b['fillQty'] = a['fillQty'] + fillQty;
				a['orderStatus'] = b['orderStatus'] = ((a['fillQty'] == a['qty']) ? 11 : 10);
				a['updateTimestamp'] = b['updateTimestamp'] = stock['updateTimestamp']; //用于成交打点,考虑延时行情
				if (empty(msgs[a['uid']])) {
					msgs[a['uid']] = [];
				}
				msgs[a['uid']].push({
					'code': a['code'],
					'secType': a['secType'],
					'createTimestamp': a['createTimestamp'],
					'msg': "成功" + (a['trdSide'] == 1 ? "开多" : "平空") + fillQty + "@" + a['price'] + "[" + a['name'] + "]"
				});
			}
		}
		if (in_array(a['trdSide'], [2, 3])) { //卖出,开空
			if (fBid && (a['price'] <= fBid['price']) && (o['svrRecvTime'] >= a['updateTimestamp'])) { //小于买一,则从买一开始逐档成交
				for (let i in o['orderBookBidList']) { //从买一开始
					let Bid = o['orderBookBidList'][i];
					if (a['price'] > Bid['price']) {
						break;
					}
					Bid['volume'] = intval(l2s(Bid['volume']));
					let key = implode(':', ['Bid', a['uid'], a['code'], a['trdSide'], sprintf("%.3f", Bid['price'])]); //此人今天在这个价位成交了多少
					let fillQty = 0;
					if (fillQty = max(0, min(a['qty'] - a['fillQty'], Bid['volume'] - intval(_this.kvs[key])))) { //可以买的
						a['fillAvgPrice'] = b['fillAvgPrice'] = (a['fillAvgPrice'] * a['fillQty'] + Bid['price'] * fillQty) / (a['fillQty'] + fillQty);
						a['fillQty'] = b['fillQty'] = a['fillQty'] + fillQty;
						a['orderStatus'] = b['orderStatus'] = ((a['fillQty'] == a['qty']) ? 11 : 10);
						a['updateTimestamp'] = b['updateTimestamp'] = o['svrRecvTime'];
						_this.kvs[key] = intval(_this.kvs[key]) + fillQty;
						_this.db.table("z-kvs").put({
							type: 0,
							key: key,
							value: _this.kvs[key],
							expire: mktime(24, 0, 0)
						});
						if (empty(msgs[a['uid']])) {
							msgs[a['uid']] = [];
						}
						msgs[a['uid']].push({
							'code': a['code'],
							'secType': a['secType'],
							'createTimestamp': a['createTimestamp'],
							'msg': "成功" + (a['trdSide'] == 2 ? "平多" : "开空") + fillQty + "@" + a['price'] + "[" + a['name'] + "]"
						});
					}
					if (a['orderStatus'] == 11) {
						break;
					}
				}
			}
			if (in_array(a['orderStatus'], [5, 10]) && tickers.length) { //查逐笔
				for (let k in tickers) {
					let t = tickers[k];
					if (t['timestamp'] < a['updateTimestamp']) { //比订单还早的数据
						continue;
					}
					if (a['price'] > t['price']) {
						continue;
					}
					if (t[a['uid']]) {
						continue;
					}
					tickers[k][a['uid']] = true;
					t['volume'] = intval(l2s(t['volume']));
					if (a['volume']) { //先得把卖档吃掉
						let volume = max(0, a['volume'] - t['volume']);
						t['volume'] -= a['volume'];
						a['volume'] = b['volume'] = volume;
					}
					let fillQty = 0;
					if (fillQty = max(0, min(a['qty'] - a['fillQty'], t['volume']))) {
						a['fillAvgPrice'] = b['fillAvgPrice'] = (a['fillAvgPrice'] * a['fillQty'] + a['price'] * fillQty) / (a['fillQty'] + fillQty);
						a['fillQty'] = b['fillQty'] = a['fillQty'] + fillQty;
						a['orderStatus'] = b['orderStatus'] = ((a['fillQty'] == a['qty']) ? 11 : 10);
						a['updateTimestamp'] = b['updateTimestamp'] = t['timestamp'];
						if (empty(msgs[a['uid']])) {
							msgs[a['uid']] = [];
						}
						msgs[a['uid']].push({
							'code': a['code'],
							'secType': a['secType'],
							'createTimestamp': a['createTimestamp'],
							'msg': "成功" + (a['trdSide'] == 2 ? "平多" : "开空") + fillQty + "@" + a['price'] + "[" + a['name'] + "]"
						});
					}
					if (a['orderStatus'] == 11) {
						break;
					}
				}
			}
			if (in_array(a['orderStatus'], [5, 10]) && fAsk && lAsk && (a['price'] >= fAsk['price']) && (a['price'] <= lAsk['price'])) { //查看摆盘是否有变化(排队)
				for (let i in o['orderBookAskList']) {
					let Ask = o['orderBookAskList'][i];
					if (a['price'] == Ask['price']) {
						Ask['volume'] = intval(l2s(Ask['volume']));
						if (is_null(a['volume']) || (a['volume'] > Ask['volume'])) {
							a['volume'] = b['volume'] = Ask['volume'];
						}
						break;
					}
				}
			}
			if ((_this.tmode == 1) && stock['curPrice'] && (stock['curPrice'] >= a['price']) && (stock['updateTimestamp'] > a['updateTimestamp'])) { //简单报价成交模式
				let fillQty = a['qty']; //一次成交
				a['fillAvgPrice'] = b['fillAvgPrice'] = (a['fillAvgPrice'] * a['fillQty'] + stock['curPrice'] * fillQty) / (a['fillQty'] + fillQty);
				a['fillQty'] = b['fillQty'] = a['fillQty'] + fillQty;
				a['orderStatus'] = b['orderStatus'] = ((a['fillQty'] == a['qty']) ? 11 : 10);
				a['updateTimestamp'] = b['updateTimestamp'] = stock['updateTimestamp']; //用于成交打点,考虑延时行情
				if (empty(msgs[a['uid']])) {
					msgs[a['uid']] = [];
				}
				msgs[a['uid']].push({
					'code': a['code'],
					'secType': a['secType'],
					'createTimestamp': a['createTimestamp'],
					'msg': "成功" + (a['trdSide'] == 2 ? "平多" : "开空") + fillQty + "@" + a['price'] + "[" + a['name'] + "]"
				});
			}
		}
		if (empty(b)) {
			continue;
		}
		b['orderIDEx'] = a['orderIDEx'];
		order(b, true);
	}
	if (empty(msgs)) { //没有成交的
		return false;
	}
	for (let uid in msgs) {
		if (_this.uid != uid) {
			continue;
		}
		for (let i in msgs[uid]) {
			let msg = msgs[uid][i];
			if (msg['secType'] != 3) {
				continue;
			}
			_this.post({ //模拟后端推送消息
				proto: 1003,
				serialNo: 0
			}, {
				s2c: {
					type: -2,
					event: {
						eventType: -2,
						desc: json_encode({
							"desc": msg['msg'],
							"news": [],
							"gaps": [],
							"events": []
						})
					}
				}
			});
		}
	}
	return true;
}
/**
 * 计算单用户持仓和资金
 * @param int uid
 */
function do_position(uid) {
	if (empty(_this.funds[uid])) { //
		return false;
	}
	let now = time();
	let zero = mktime(0, 0, 0) + 9 * 60 * 60; //今天9点
	let positions = [
		[],
		[]
	]; //多头空头
	let funds = {
		'gain': 0, //现金结余
		'marketVal': 0, //证券市值
		'plVal': 0, //总盈亏
		'plRatio': 0, //总盈亏比例
		'costVal': 0, //成本
		'td_plVal': 0 //今日盈亏
	};
	for (let orderIDEx in _this.u2o[uid]) {
		orderIDEx = intval(orderIDEx);
		let a = _this.orders[orderIDEx];
		if (empty(positions[a['direction']][a['code']])) {
			positions[a['direction']][a['code']] = [];
		}
		let p = positions[a['direction']][a['code']]; //上一轮的结果
		if (empty(p['orderStatus'])) {
			p['orderStatus'] = intval(a['orderStatus']);
		}
		if (in_array(a['orderStatus'], [5, 10, 22])) { //未完成的
			p['orderStatus'] = intval(a['orderStatus']); //标记还有未完成的
		}
		if (in_array(a['f'], [0])) { //未清仓
			p['f'] = a['f']; //标记还有未清仓的
		}
		if (in_array(a['trdSide'], [1, 3])) { //开多,开空
			p['plVal'] = floatval(p['plVal']) - floatval(a['fillAvgPrice']) * floatval(a['fillQty']); //盈亏金额
			p['trdVal'] = floatval(p['trdVal']) + floatval(a['fillAvgPrice']) * floatval(a['fillQty']); //成交总额
			p['buyQty'] = floatval(p['buyQty']) + floatval(a['fillQty']); //买入总量
			p['buyVal'] = floatval(p['buyVal']) + floatval(a['fillAvgPrice']) * floatval(a['fillQty']); //买入总额
			p['qty'] = floatval(p['qty']) + floatval(a['fillQty']); //持有数量
			if (a['f'] == 0) { //今日未清仓
				p['buyVal2'] = floatval(p['buyVal2']) + floatval(a['fillAvgPrice']) * floatval(a['fillQty']); //清仓后的买入总额
			}
			p['canSellQty'] = floatval(p['canSellQty']) + floatval(a['fillQty']); //可卖数量
			if (a['updateTimestamp'] >= zero) { //今日统计(昨天成交了一部分的情况下有误差)
				p['td_qty'] = floatval(p['td_qty']) + floatval(a['fillQty']); //今日持仓
				p['td_trdVal'] = floatval(p['td_trdVal']) + floatval(a['fillAvgPrice']) * floatval(a['fillQty']); //今日成交额
				p['td_buyQty'] = floatval(p['td_buyQty']) + floatval(a['fillQty']); //今日买入量
				p['td_buyVal'] = floatval(p['td_buyVal']) + floatval(a['fillAvgPrice']) * floatval(a['fillQty']); //今日买入额
			}
			if (in_array(a['orderStatus'], [5, 10])) { //生效中的
				funds['gain'] = floatval(funds['gain']) - floatval(a['price']) * (floatval(a['qty']) - floatval(a['fillQty'])); //现金结余(冻结)
			}
		}
		if (in_array(a['trdSide'], [2, 4])) { //平多,平空
			p['plVal'] = floatval(p['plVal']) + floatval(a['fillAvgPrice']) * floatval(a['fillQty']); //盈亏金额
			p['trdVal'] = floatval(p['trdVal']) + floatval(a['fillAvgPrice']) * floatval(a['fillQty']); //成交总额
			p['sellQty'] = floatval(p['sellQty']) + floatval(a['sellQty']); //卖出总量
			p['sellVal'] = floatval(p['sellVal']) + floatval(a['fillAvgPrice']) * floatval(a['fillQty']); //卖出总额
			p['qty'] = floatval(p['qty']) - floatval(a['fillQty']); //持有数量
			if (a['f'] == 0) { //今日未清仓
				p['sellVal2'] = floatval(p['sellVal2']) + floatval(a['fillAvgPrice']) * floatval(a['fillQty']); //清仓后的卖出总额
			}
			if (in_array(a['orderStatus'], [5, 10, 11])) { //生效中/部分成交/已经完成
				p['canSellQty'] = floatval(p['canSellQty']) - floatval(a['qty']); //可卖数量
			}
			if (in_array(a['orderStatus'], [14])) { //部分完成剩余已撤单
				p['canSellQty'] = floatval(p['canSellQty']) - floatval(a['fillQty']); //可卖数量
			}
			if (a['updateTimestamp'] >= zero) { //今日统计
				p['td_qty'] = floatval(p['td_qty']) - floatval(a['fillQty']); //今日持仓
				p['td_trdVal'] = floatval(p['td_trdVal']) + floatval(a['fillAvgPrice']) * floatval(a['fillQty']); //今日成交额
				p['td_sellQty'] = floatval(p['td_sellQty']) + floatval(a['fillQty']); //今日卖出量
				p['td_sellVal'] = floatval(p['td_sellVal']) + floatval(a['fillAvgPrice']) * floatval(a['fillQty']); //今日卖出额
			}
		}
		positions[a['direction']][a['code']] = {
			'positionID': unique(implode('-', [a['code'], a['direction']])),
			'positionSide': intval(a['direction']),
			'code': a['code'],
			'name': a['name'],
			'type': intval(a['type']),
			'price': floatval(a['price']), //占位
			'secType': intval(a['secType']),
			'contractSize': intval(a['contractSize']),
			'qotMarket': intval(a['qotMarket']),
			'trdMarket': intval(a['trdMarket']),
			'secMarket': intval(a['secMarket']),
			'owner_code': a['owner_code'],
			'trdVal': floatval(p['trdVal']), //成交总额
			'buyQty': floatval(p['buyQty']), //买入总量
			'buyVal': floatval(p['buyVal']), //买入总额
			'buyVal2': floatval(p['buyVal2']), //清仓后的买入总额
			'sellQty': floatval(p['sellQty']), //卖出总额
			'sellVal': floatval(p['sellVal']), //卖出总额
			'sellVal2': floatval(p['sellVal2']), //清仓后的卖出总额
			'qty': floatval(p['qty']), //持有数量
			'canSellQty': floatval(p['canSellQty']), //可卖数量
			'td_qty': floatval(p['td_qty']), //今日持仓
			'td_trdVal': floatval(p['td_trdVal']), //今日成交额
			'td_buyQty': floatval(p['td_buyQty']), //今日买入量
			'td_buyVal': floatval(p['td_buyVal']), //今日买入总额
			'td_sellQty': floatval(p['td_sellQty']), //今日卖出量
			'td_sellVal': floatval(p['td_sellVal']), //今日卖出总额
			'orderStatus': floatval(p['orderStatus']), //是否完成状态
			'updateTimestamp': max(p['updateTimestamp'] || 0, a['updateTimestamp'] || 0),
			'f': (p['f'] === 0) ? 0 : null //是否完成了清仓
		};
	}
	for (let direction in positions) {
		let list = positions[direction];
		for (let code in list) {
			let p = list[code];
			let b = array_merge({
				curPrice: p['price']
			}, _this.stocks[code]);
			if ((p['qty'] == 0) && (in_array(p['orderStatus'], [5, 10, 22]) == false) && (p['f'] === 0)) { //该用户对应code已清仓
				for (let orderIDEx in _this.u2o[uid]) {
					orderIDEx = intval(orderIDEx);
					let a = _this.orders[orderIDEx];
					if ((a['code'] == code) && (a['direction'] == direction) && (a['f'] == 0)) {
						order({
							'orderIDEx': orderIDEx,
							'f': 1
						}, true); //标记为今日已清仓(要下一次才能生效)
					}
				}
			}
			let val = 0; //市值
			let plVal = 0; //盈亏金额(市值减去成本)
			let costPrice = 0; //成本价
			let plRatio = 0; //盈亏比例
			let td_val = 0; //今日持仓的市值
			let td_plVal = 0; //今日盈亏(总盈亏金额减去隔日持仓)
			if (direction == 0) { //多头
				val = floatval(p['qty']) * floatval(b['curPrice']); //市值
				plVal = val + floatval(p['sellVal']) - floatval(p['buyVal']); //盈亏金额(市值减去成本)
				costPrice = p['qty'] ? ((floatval(p['buyVal2']) - floatval(p['sellVal2'])) / floatval(p['qty'])) : 0; //成本价
				plRatio = (costPrice && p['qty']) ? plVal / (costPrice * floatval(p['qty'])) : 0; //盈亏比例
				td_val = floatval(p['td_qty']) * floatval(b['curPrice']); //今日持仓的市值
				td_plVal = (td_val + floatval(p['td_sellVal']) - floatval(p['td_buyVal'])) + (floatval(p['qty']) - floatval(p['td_qty'])) * (floatval(b['curPrice']) - floatval(b['lastClosePrice']));
			}
			if (direction == 1) { //空头
				val = floatval(p['qty']) * floatval(b['curPrice']); //市值
				plVal = floatval(p['buyVal']) - floatval(p['sellVal']) - val; //盈亏金额(市值减去成本)
				costPrice = p['qty'] ? ((floatval(p['buyVal2']) - floatval(p['sellVal2'])) / floatval(p['qty'])) : 0; //成本价
				plRatio = (costPrice && p['qty']) ? plVal / (costPrice * floatval(p['qty'])) : 0; //盈亏比例
				td_val = floatval(p['td_qty']) * floatval(b['curPrice']); //今日持仓的市值
				td_plVal = (floatval(p['td_buyVal']) - floatval(p['td_sellVal']) - td_val) + (floatval(p['qty']) - floatval(p['td_qty'])) * (floatval(b['lastClosePrice']) - floatval(b['curPrice']));
			}
			plVal *= p['contractSize'];
			td_plVal *= p['contractSize'];
			p['curPrice'] = floatval(b['curPrice']);
			p['price'] = floatval(b['curPrice']);
			p['val'] = val; //市值
			p['plVal'] = plVal; //盈亏金额
			p['plRatio'] = plRatio; //盈亏比例
			p['td_plVal'] = td_plVal; //今日盈亏
			p['costPrice'] = costPrice; //成本价
			funds['gain'] += (floatval(p['sellVal']) - floatval(p['buyVal'])); //现金结余
			funds['marketVal'] += val; //证券市值
			funds['plVal'] += plVal; //总盈亏
			funds['plRatio'] = 0; //总盈亏比例
			funds['costVal'] += floatval(p['qty']) * costPrice; //成本
			funds['td_plVal'] += td_plVal; //今日盈亏
			positions[direction][code] = p;
			if ((p['qty'] == 0) && in_array(p['orderStatus'], [11, 14]) && (p['updateTimestamp'] <= zero)) { //可以清仓
				delete positions[direction][code];
				for (let orderIDEx in _this.u2o[uid]) {
					orderIDEx = intval(orderIDEx);
					let a = _this.orders[orderIDEx];
					if ((a['code'] == code) && (a['direction'] == direction)) {
						order({
							'orderIDEx': orderIDEx,
							'f': 2
						}, true);
					}
				}
				_this.db.table("z-users").where("uid").equals(uid).modify(function(a) {
					a.gain += p['plVal'];
				});
			}
		}
	}
	_this.positions[uid] = positions;
	_this.funds[uid] = array_merge(_this.funds[uid], {
		'cash': _this.funds[uid]['gain'] + funds['gain'], //现金结余
		'gain': _this.funds[uid]['gain'],
		'marketVal': funds['marketVal'], //证券市值
		'plVal': funds['plVal'], //总盈亏
		'plRatio': funds['costVal'] ? (funds['plVal'] / funds['costVal']) : 0, //总盈亏比例
		'costVal': funds['costVal'], //成本
		'td_plVal': funds['td_plVal'], //今日盈亏
		'uptime': now //更新时间
	});
}
_this.task = new Array();
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
	_this.uid = abs(intval(m.c2s.uid));
	if (empty(_this.uid)) {
		return _this.post(m, {
			'retType': -1,
			'retMsg': '用户不存在!'
		});
	}
	_this.tmode = intval(m.c2s.tmode);
	if (in_array(_this.tmode, [1, 2], true) == false) {
		return _this.post(m, {
			'retType': -1,
			'retMsg': '交易模式错!'
		});
	}
	let now = time();
	let zero = mktime(0, 0, 0);
	_this.orderIDEx = now;
	_this.db = initdb(); //
	_this.db.open().then(function() {
		return _this.db.table("z-users").where({
			uid: _this.uid
		}).each(function(a) {
			_this.funds[a['uid']] = {
				'cash': a['cash'] + a['gain'], //现金
				'gain': a['cash'] + a['gain'], //盈利汇总
				'marketVal': 0, //证券市值
				'plVal': 0, //总盈亏
				'plRatio': 0, //总盈亏比例
				'costVal': 0, //成本
				'td_plVal': 0, //今日盈亏
				'uptime': now //更新时间
			};
		}).then(function() {
			return _this.db.table("z-kvs").where("expire").between(1, zero).delete().then(function() {
				return _this.db.table("z-kvs").each(function(a) {
					if (a.type == 0) {
						_this.kvs[a.key] = a.value;
					}
				}).then(function() {
					if (empty(_this.funds[_this.uid])) {
						_this.funds[_this.uid] = {
							'cash': 1000000, //现金结余
							'gain': 1000000, //盈利汇总
							'marketVal': 0, //证券市值
							'plVal': 0, //总盈亏
							'plRatio': 0, //总盈亏比例
							'costVal': 0, //成本
							'td_plVal': 0, //今日盈亏
							'uptime': now //更新时间
						};
						return _this.db.table("z-users").add({
							uid: _this.uid,
							cash: 1000000,
							gain: 0
						});
					}
				}).then(function() {
					_this.positions[_this.uid] = [
						[],
						[]
					];
					return _this.db.table("z-orders").where("uid").equals(_this.uid).and(function(a) {
						return in_array(a.f, [0, 1]);
					}).each(function(a) { //进入order初始化
						a = order(a, false);
					}).then(function() {
						for (let uid in _this.positions) {
							do_position(uid);
						}
					}).then(function() {
						return _this.post(m, {
							proto: 1001
						});
					});
				});
			});
		});
	}).catch(function(e) {
		console.log(e.stack || e);
	}).finally(function() {});
};
/**
 * 获取交易账户列表;此处统一到一个账户
 * @param {type} m
 * @returns {undefined}
 */
_this.task[2001] = function(m) {
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
	s2c.orderList = [];
	for (let orderIDEx in _this.u2o[_this.uid]) {
		orderIDEx = intval(orderIDEx);
		let o = _this.orders[orderIDEx];
		if (o.trdMarket != m.c2s.header['trdMarket']) {
			continue;
		}
		if (in_array(o['orderStatus'], [11, 14]) == true) {
			//continue;
		}
		if (o['updateTimestamp'] < beginTime) {
			//continue;
		}
		if (o['updateTimestamp'] >= endTime) {
			//continue;
		}
		s2c.orderList.push(array_merge(o)); //数组要打破引用
	}
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
 * 查询历史成交
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
 * 查询交易业务账户的持仓列表
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
	let s2c = {};
	s2c.header = m.c2s.header;
	s2c.positionList = [];
	for (let direction in _this.positions[_this.uid]) {
		let list = _this.positions[_this.uid][direction];
		for (let code in list) {
			let p = list[code];
			if (p.trdMarket != m.c2s.header['trdMarket']) {
				continue;
			}
			s2c.positionList.push(array_merge(p));
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
	if (empty(m['c2s']['o'])) {
		return _this.post(m, {
			'retType': -1,
			'retMsg': '无扩展信息!'
		});
	}
	if (empty(m['c2s']['o']['contractSize'])) {
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
	let trdSide = intval(m['c2s']['trdSide']);
	let remark = floatval(m['c2s']['remark']); //记录成本价
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
	let direction = in_array(trdSide, [3, 4]) ? 1 : 0;
	if (in_array(trdSide, [1, 3])) { //如果开多/开空,要看余额,要看方向(不能同时持有多空)
		if ((trdSide == 3) && (m['c2s']['o']['secType'] != 10)) { //仅期货支持做空
			return _this.post(m, {
				'retType': -1,
				'retMsg': '仅期货能做空!'
			});
		}
		if (qty * price > _this.funds[_this.uid]['cash']) {
			return _this.post(m, {
				'retType': -1,
				'retMsg': '账户余额不足!'
			});
		}
		let p = _this.positions[_this.uid][direction ? 0 : 1][code];
		if (p && in_array(p['orderStatus'], [5, 10, 22])) { //有未完成订单
			return _this.post(m, {
				'retType': -1,
				'retMsg': '有反方向订单!'
			});
		}
		if (p && p['qty']) {
			return _this.post(m, {
				'retType': -1,
				'retMsg': '多空相互排斥!'
			});
		}
	}
	if (in_array(trdSide, [2, 4])) { //如果平多/平空,要看持仓
		let p = _this.positions[_this.uid][direction][code];
		if (qty > floatval(p['canSellQty'])) {
			return _this.post(m, {
				'retType': -1,
				'retMsg': '账户持仓不足!'
			});
		}
	}

	let now = time();
	let orderIDEx = ++_this.orderIDEx;
	let a = {
		'orderIDEx': orderIDEx,
		'uid': _this.uid,
		'code': code,
		'name': trim(m['c2s']['o']['name']),
		'secType': intval(m['c2s']['o']['secType']),
		'type': intval(m['c2s']['o']['type']),
		'owner_code': trim(m['c2s']['o']['owner_code']),
		'orderStatus': 5,
		'trdSide': trdSide,
		'direction': direction,
		'qty': qty,
		'price': price,
		'fillQty': 0,
		'fillAvgPrice': 0,
		'remark': remark,
		'contractSize': intval(m['c2s']['o']['contractSize']),
		'qotMarket': intval(m['c2s']['o']['qotMarket']),
		'trdMarket': intval(m['c2s']['o']['trdMarket']),
		'secMarket': intval(m['c2s']['o']['secMarket']),
		'volume': null, //当前档位的量
		'createTimestamp': now,
		'updateTimestamp': now,
		'f': 0
	};
	order(a, true); //创建...
	if (do_stock(a['code']) === false) {}
	return _this.post(m, {
		s2c: {
			orderIDEx: orderIDEx
		}
	});
};
/**
 * 改价+改量/失效/生效/撤单
 * @param {type} m
 * @returns {undefined}
 */
_this.task[2205] = function(m) {
	if (empty(_this.funds[_this.uid])) {
		return _this.post(m, {
			'retType': -1,
			'retMsg': '未经初始化!'
		});
	}
	if (empty(_this.u2o[_this.uid])) {
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
	let o = {}; //指定的订单
	let orderIDEx = intval(m['c2s']['orderIDEx']);
	if (orderIDEx) { //forAll可以不传此项
		if (empty(_this.u2o[_this.uid][orderIDEx])) {
			return _this.post(m, {
				'retType': -1,
				'retMsg': '不存在的订单!'
			});
		}
		o = _this.orders[orderIDEx];
		if (empty(o)) {
			return _this.post(m, {
				'retType': -1,
				'retMsg': '不存在的订单!'
			});
		}
		if (in_array(o['orderStatus'], [5, 10, 22]) == false) { //系统中只有这几种状态能更改,11是已完成不能改
			return _this.post(m, {
				'retType': -1,
				'retMsg': '订单状态异常!'
			});
		}
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
	if (in_array(modifyOrderOp, [1, 2, 3, 4], true) == false) {
		return _this.post(m, {
			'retType': -1,
			'retMsg': '未知订单操作!'
		});
	}
	if (in_array(modifyOrderOp, [2, 3, 4], true)) {
		let orderIDExs = [];
		if (forAll && in_array(modifyOrderOp, [2], true)) {
			orderIDExs = array_keys(_this.u2o[_this.uid]);
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
			let orderIDEx = intval(orderIDExs[i]);
			if (empty(_this.u2o[_this.uid][orderIDEx])) {
				continue;
			}
			let a = _this.orders[orderIDEx];
			if (empty(a)) {
				continue;
			}
			if (in_array(a['orderStatus'], [5, 10, 22]) == false) { //系统中只有这几种状态
				continue;
			}
			if (a.trdMarket != header['trdMarket']) { //不是同一交易市场
				continue;
			}
			if (modifyOrderOp == 2) { //撤单
				if (a['fillQty'] > 0) { //成交了一部分
					order({
						'orderIDEx': orderIDEx,
						'orderStatus': 14
					}, true);
				}
				if (a['fillQty'] == 0) { //还没有任何成交
					order({
						'orderIDEx': orderIDEx,
						'orderStatus': 15
					}, true);
				}
			}
			if (modifyOrderOp == 3) { //失效
				if (a['orderStatus'] == 22) { //已经是失效状态
					continue;
				}
				order({
					'orderIDEx': orderIDEx,
					'orderStatus': 22
				}, true);
			}
			if (modifyOrderOp == 4) { //生效
				if (in_array(a['orderStatus'], [5, 10])) { //已经是生效状态
					continue;
				}
				if (in_array(a['trdSide'], [1, 3])) { //如果开多/开空,要看余额
					if ((a['qty'] * a['price'] - a['fillQty'] * a['fillAvgPrice']) > _this.funds[_this.uid]['cash']) {
						return _this.post(m, {
							'retType': -1,
							'retMsg': '账户余额不足!'
						});
					}
				}
				if (in_array(a['trdSide'], [2, 4])) { //如果平多/平空,要看持仓
					if ((a['qty'] - a['fillQty']) > _this.positions[_this.uid][a['direction']][a['code']]['canSellQty']) {
						return _this.post(m, {
							'retType': -1,
							'retMsg': '账户持仓不足!'
						});
					}
				}
				order({
					'orderIDEx': orderIDEx,
					'orderStatus': a['fillQty'] ? 10 : 5,
					'volume': null
				}, true);
				if (do_stock(a['code']) === false) {}
			}
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
		if (qty <= o['fillQty']) { //不能少于已成交的
			return _this.post(m, {
				'retType': -1,
				'retMsg': '低于成交数量!'
			});
		}
		if (in_array(o['trdSide'], [1, 3])) { //如果开多/开空,要看余额
			if ((qty * price - o['fillQty'] * o['fillAvgPrice']) > _this.funds[_this.uid]['cash']) {
				return _this.post(m, {
					'retType': -1,
					'retMsg': '账户余额不足!'
				});
			}
		}
		if (in_array(o['trdSide'], [2, 4])) { //如果平多/平空,要看持仓
			if ((qty - o['fillQty']) > (_this.positions[_this.uid][o['direction']][o['code']]['canSellQty'] + (in_array(o['orderStatus'], [5, 10]) ? o['qty'] : 0))) {
				return _this.post(m, {
					'retType': -1,
					'retMsg': '账户持仓不足!'
				});
			}
		}
		order({
			'orderIDEx': orderIDEx,
			'qty': qty,
			'price': price,
			'volume': null
		}, true);
		if (do_stock(o['code']) === false) {}
	}
	return _this.post(m, {
		's2c': {
			'orderIDEx': forAll ? 0 : orderIDEx
		}
	});
};
/**
 * 推送逐笔
 * @param {type} m
 * @returns {undefined|Boolean}
 */
_this.task[3011] = function(m) {
	if (empty(m.c2s)) {
		return _this.post(m, {
			'retType': -1,
			'retMsg': '错误的包体!'
		});
	}
	if (empty(m.c2s.s2c) || empty(m.c2s.s2c['security'])) {
		return _this.post(m, {
			'retType': -1,
			'retMsg': '错误的包体!'
		});
	}
	if(empty(m.c2s.s2c['tickerList'])){
		return false;
	}
	let code = m.c2s.s2c['security']['code'];
	if(empty(code)){
		return _this.post(m, {
			'retType': -1,
			'retMsg': '错误的包体!'
		});
	}
	let a = array_last(m.c2s.s2c['tickerList']); //最后一条
	_this.stocks[code] = {
		curPrice: a['price'],
		updateTimestamp: a['timestamp']
	};
	if (!in_array(_this.tmode, [2])) {
		return true;
	}
	if (empty(_this.w2o[code])) {
		return true;
	}
	let tickers = _this.tickers[code];
	_this.tickers[code] = array_merge(tickers, m.c2s.s2c['tickerList']);
	if (do_stock(code) === false) { //
		
	}
};
/**
 * 推送买卖盘
 * @param {type} m
 * @returns {undefined|Boolean}
 */
_this.task[3013] = function(m) {
	if (empty(m.c2s)) {
		return _this.post(m, {
			'retType': -1,
			'retMsg': '错误的包体!'
		});
	}
	if (empty(m.c2s.s2c) || empty(m.c2s.s2c['security'])) {
		return _this.post(m, {
			'retType': -1,
			'retMsg': '错误的包体!'
		});
	}
	if(is_array(m.c2s.s2c['orderBookBidList']) !== true){
		return _this.post(m, {
			'retType': -1,
			'retMsg': '错误的包体!'
		});
	}
	if(is_array(m.c2s.s2c['orderBookAskList']) !== true){
		return _this.post(m, {
			'retType': -1,
			'retMsg': '错误的包体!'
		});
	}
	let at = intval(m.c2s.s2c['svrRecvTimeBidTimestamp']);
	let bt = intval(m.c2s.s2c['svrRecvTimeAskTimestamp']);

	m.c2s.s2c['svrRecvTime'] = max(at, bt) || time(); //用于对订单的判断
	
	let code = m.c2s.s2c['security']['code'];
	if(empty(code)){
		return _this.post(m, {
			'retType': -1,
			'retMsg': '错误的包体!'
		});
	}
	if (empty(_this.stocks[code])) {
		_this.stocks[code] = {
			curPrice: 0,
			updateTimestamp: 0
		};
	}
	if (_this.stocks[code]['curPrice'] < m.c2s.s2c['orderBookBidList'][0]['price']) { //买入价
		_this.stocks[code] = {
			curPrice: m.c2s.s2c['orderBookBidList'][0]['price'],
			updateTimestamp: m.c2s.s2c['svrRecvTime']
		};
	}
	if (_this.stocks[code]['curPrice'] > m.c2s.s2c['orderBookAskList'][0]['price']) { //卖出价
		_this.stocks[code] = {
			curPrice: m.c2s.s2c['orderBookAskList'][0]['price'],
			updateTimestamp: m.c2s.s2c['svrRecvTime']
		};
	}
	_this.bookers[code] = m.c2s.s2c;
	if (in_array(_this.tmode, [2]) && do_stock(code)) { //1以实时报价进行成交;2以买买盘和逐笔进行成交
	
	}
};
/**
 * 推送实时报价
 * @param {type} m
 * @returns {undefined|Boolean}
 */
_this.task[3005] = function(m) {
	if (empty(m.c2s)) {
		return _this.post(m, {
			'retType': -1,
			'retMsg': '错误的包体!'
		});
	}
	if (empty(m.c2s.s2c)) {
		return _this.post(m, {
			'retType': -1,
			'retMsg': '错误的包体!'
		});
	}
	for (let i in m.c2s.s2c['basicQotList']) {
		let o = m.c2s.s2c['basicQotList'][i];
		let code = o['security']['code'];
		if (empty(_this.stocks[code])) {
			_this.stocks[code] = {
				curPrice: 0
			};
		}
		if (_this.stocks[code]['curPrice'] == o['curPrice']) {
			continue;
		}
		_this.stocks[code]['curPrice'] = o['curPrice'];
		_this.stocks[code]['updateTimestamp'] = o['updateTimestamp'] || time();
		if (in_array(_this.tmode, [1]) && do_stock(code)) { //1以实时报价进行成交;2以买买盘和逐笔进行成交
			
		}
	}
};
/**
 * 保活心跳
 * @param {type} m
 * @returns {undefined}
 */
_this.task[1004] = function(m) {
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
 * 限制频率(只是仿真,刷新页面就能跳过)
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
	return array_push(_this.qq[proto], now) <= cnt ? true : false;
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