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
'use strict';
task = new Array(); //已在common.js中定义
task[1001] = function(s2c) { //成功连上了,先连行情再连交易
	if (empty(s2c.wk) == true) { //来自行情连接

	}
	if (empty(s2c.wk) == false) { //来自交易连接
		Z.connID = l2s(s2c.connID); //只有下单处需要这个
	}
	if (empty(Z.Timer)) { //还没完成,确保两个连接都成功了
		return true;
	}
	if (in_array(O.pmode, [3])) { //页面交易模式直接进入交易环节
		return Z.Trd_GetAccList();
	}
	Z.Qot_GetStaticInfo(0, [O.code]); //第一步:获取静态信息,进一步确认标的
};
task[3202] = function(s2c) { //标的静态信息
	for (let i in s2c.staticInfoList) {
		let a = s2c.staticInfoList[i];
		let code = a['basic']['security']['code'];
		Object.assign(Z.stocks[code], { //保持引用
			qotType: min(6, a['basic']['secType']), //表示走完了3202接口
			name: a['basic']['name'],
			lotSize: a['basic']['lotSize'] * 1, //每手股数,期货在富途的这个接口为合约乘数
			secType: a['basic']['secType'] * 1,
			exchType: a['basic']['exchType'] * 1, //交易所
			delisting: boolval(a['basic']['delisting'])
		});
		if (a['warrantExData'] && a['warrantExData']["owner"]) { //涡轮
			Z.stocks[code]["type"] = a['warrantExData']["type"];
			Z.stocks[code]["owner_code"] = a['warrantExData']["owner"]["code"]; //正股的owner_code是其自身
		}
		if (Z.stocks[code]['delisting'] || empty(Z.stocks[code]['exchType'])) {
			return alert(`不存在${code}!`);
		}
		if (in_array(Z.stocks[code]['secType'], [3, 6, 10])) {
			Z.Qot_GetFutureInfo([code], in_array(Z.stocks[code]['secType'], [3, 6])); //期货需要进一步的信息.此接口限频:30秒30次
		}
	}
};
task[3203] = function(s2c) { //标的快照
	for (let i in s2c.snapshotList) {
		let a = s2c.snapshotList[i];
	}
};
task[3218] = function(s2c) { //期货资料
	for (let i in s2c.futureInfoList) {
		let a = s2c.futureInfoList[i];
		let code = a["security"]["code"];
		let o = { //qotType == secType 标识该标的信息化完成
			'qotType': 10
		};
		o['lotSize'] = 1; //期货最小单位为一手
		if (isset(a['origin'])) { //正股和涡轮的origin_code是其自身
			o['origin_code'] = a['origin']['code']; //下单用
		}
		if (isset(a['owner'])) {
			o['owner_code'] = a['owner']['code']; //订单打点用
		}
		if (isset(a['name'])) {
			o['name'] = a['name'];
		}
		if (a["lower_limit"]) { //跌停板
			o["lower_limit"] = a["lower_limit"] * 1;
		}
		if (a["upper_limit"]) { //涨停板
			o["upper_limit"] = a["upper_limit"] * 1;
		}
		if (a["contractSize"]) { //合约乘数
			o["contractSize"] = a["contractSize"] * 1;
		}
		if (a["minVar"]) { //最小变动单位
			o["minVar"] = a["minVar"] * 1;
		}
		Object.assign(Z.stocks[code], o); //保持引用
	}
	if (empty(O.pmode)) { //无需相关展示
		return true;
	}
	if (is_array(trades)) { //已经初始化过
		return true;
	}
	window.trades = []; //锁住
	Z.stock(Q['origin_code'], {
		force: true
	}); //取得下单标的资料
	let beginTime = mktime(0, 0, 0, 1, 1, 2016); //一分K支持8年
	let endTime = mktime(0, 0, 0) + 14 * 24 * 60 * 60; //今天0点往后多取一些以便判断结算日
	Z.Qot_RequestTradeDate(beginTime, endTime); //第二步:获取近期的交易日,以便得到历史K线,此接口限频:30秒30次
};
task[3219] = function(s2c) { //交易日期
	let time = 0;
	if (preg_match(/^\d{10}$/, O.day)) { //时间戳先转date
		O.day = date('Ymd', O.day);
	}
	if (preg_match(/^\d{8}$/, O.day)) { //date转day,形如: 20180101
		time = strtotime(O.day) * 1;
	}
	const zero = mktime(0, 0, 0); //今天0点
	for (let i = s2c.tradeDateList.length - 1; i >= 0; i--) {
		let timestamp = s2c.tradeDateList[i]['timestamp'] * 1;
		if ((timestamp == zero) && s2c.tradeDateList[i + 1] && s2c.tradeDateList[i + 2]) { //判断恒指期货结算日
			O.ISTRADE = true;
			let x = s2c.tradeDateList[i + 1]['timestamp'] * 1; //"明天":下一个交易日
			let y = s2c.tradeDateList[i + 2]['timestamp'] * 1; //"后天"
			if (date('n', x) != date('n', y)) { //明天是本月最后一个交易日,则今天是结算日
				O.ISCLEAR = true;
			}
		}
		if (timestamp == zero + 24 * 60 * 60) {
			O.ISCLOSE = false;
		}
		if (timestamp > zero) {
			continue;
		}
		if (time >= timestamp) {
			return window.open(G.path + '?' + http_build_query(array_merge($_GET, {
				'day': trades.length
			})), '_self');
		}
		trades.push(timestamp);
	}
	if (empty(trades[O.day]) || empty(trades[O.day + 1])) {
		return alert('日期超出范围!', {
			url: G.path + '?' + http_build_query(array_merge($_GET, {
				'day': 0
			}))
		});
	}
	O.date = trades[O.day]; //该交易日的零点

	let kn = 4 * 60; //kline number 每天交易时长算4小时,合计产生240根分钟K
	let pn = array_last(KL2SUB[O.klType]); //该K线类型对应的时间周期(分钟)
	if (pn > kn) { //如果是4小时以上的周期,按跨天计算
		pn /= (24 * 60 / kn);
	}
	let dn = ceil((prefs.cpoints + 60) * pn / kn); //多取60根以便计算均线

	if (O.klType == 2) { //日线拿N年
		dn = min(trades.length - 1, 250 * 5) - O.day;
	}

	Z.Qot_RequestHistoryKL(O.code, O.klType, trades[O.day + dn], O.date + 33 * 60 * 60, 0, '', [], 1, 0); //第三步:获取K线
};
task[3103] = function(s2c) { //历史K线,这里用的是O.code,实时K线用origin_code,两个拼起来
	if (is_array(window.klines)) { //已经初始化过
		return true;
	}
	window.klines = []; //锁住
	let low = Number.MAX_VALUE; //最高最低价以便计算Y轴
	let high = Number.MIN_VALUE;
	let zero = mktime(0, 0, 0); //今天0点
	for (let i in s2c['klList']) {
		let a = s2c['klList'][i];

		let x = window.klines.at(-1); //最后那一根
		if (x && empty(a['lastClosePrice'])) { //如平台无此字段,则此处补上
			a['lastClosePrice'] = x[4];
		}

		let k = K(a);
		if (a['timestamp'] <= zero - 8 * 60 * 60) { //昨天16:00的当成昨收价[这个数值只针对港股]
			Q['lastClosePrice'] = a['closePrice'];
		}
		let b = s2c['klList'][i * 1 + 60];
		let c = s2c['klList'][i * 1 + prefs.cpoints + 60];
		if (b && c && (b['timestamp'] < (O.date + 9 * 60 * 60))) { //多取60根以便计算均线,当天的全部要用于显示水平线
			//continue;
		}

		Q['curPrice'] = a['closePrice']; //最后一根当成最新价
		low = min(low, a['lowPrice']);
		high = max(high, a['highPrice']);
		window.klines.push(k);
	}
	empty(Q['minVar']) && Object.assign(Q, { //每档的跨度,港股正股根据价格计算
		minVar: (gear_up(Q['curPrice'], 1, Q['code']) - Q['curPrice']).toFixed(3) * 1
	});
	prefs.tickInterval = array_first(Q['props'][O.klType]) * Q['minVar']; //得到每格价格范围[Y轴网格线yGrid]
	prefs.crange = prefs.tickInterval * prefs.cticks; //Y轴总计能显示的价格范围
	prefs.cYmin = floor(min(low, Q['curPrice'] - prefs.crange / 2) / prefs.tickInterval) * prefs.tickInterval; //Y轴最小值
	prefs.cYmax = max(prefs.cYmin + prefs.crange, ceil(max(high, Q['curPrice'] + prefs.crange / 2) / prefs.tickInterval) * prefs.tickInterval);
	prefs.wticks = ($('#w-container').height() / 40);
	prefs.wickInterval = prefs.tickInterval * 5; //期货当前价与恒指差不多
	prefs.wrange = prefs.wickInterval * prefs.wticks;
	prefs.wYmin = floor((Q['curPrice'] - prefs.wrange / 2) / prefs.wickInterval) * prefs.wickInterval; //居中
	prefs.wYmax = prefs.wYmin + prefs.wrange;
	kchart(klines); //根据K线生成主图
	if (empty(O.day)) { //当天行情需要订阅实时
		Z.Qot_Sub([Q['origin_code']], [array_first(KL2SUB[O.klType]), 2, 4], true, true, [1], true); //订阅实时K线+摆盘+逐笔
		if (!in_array(Q['owner_code'], [Q['origin_code'], Q['code']])) { //恒指期货对应的owner_code是恒指,恒指牛熊证需要看恒指报价
			Z.Qot_Sub([Q['owner_code']], [array_first(KL2SUB[O.klType])], true, true, [1], true);
		}
	}
	let s = "";
	let a = fees(Q['curPrice'], Q['code']); //动态手续费

	s = `${Q['name']}<br>`;
	s += `code:${Q['code']}<br>`;
	s += `owner_code:${Q['owner_code']}<br>`;
	s += `origin_code:${Q['origin_code']}<br>`;
	s += `保证金:${(Q['props']['marg'] * Q['curPrice'] * Q['contractSize'] / 100).toFixed(0)};<br>`;
	s += `手续费:${a[0]} + ${a[1]};<br>`;
	s += array_first(Q['props'][O.klType]) + "档/" + (prefs.tickInterval * Q['contractSize']).toFixed(3) + "元/格;<br>";
	s += (Q['minVar'] * Q['contractSize']).toFixed(3) + "元/" + Q['minVar'] + "点/档;";
	s += `${KL2SUB[O.klType][1]};<br>`;
	s += `最多${Q['props']['maxq']}单;每单${Q['props']['lots']}手;每手${Q['lotSize']}股;`;
	$('#gap').html(s);
	let q = format(Q['curPrice'] - Q['lastClosePrice'], 3);
	if (in_array(O.pmode, [4])) { //简易图模式:只需要初始化主图和订阅本尊实时K线
		$('#tips').html((q > 0 ? '+' : '') + q);
		if (kvs.inverted) { //反转
			inverted(1);
		}
		return preloader(false); //解屏
	}
	Z.Trd_GetAccList(); //第四步:获取交易账号[交易和查询历史成交都需要]
	if (in_array(O.pmode, [5])) { //复盘模式:逐日查看往期K线图,往期的不需要实时,但需要交易账号查询历史成交以便打点
		if (kvs.pivoted) { //是否显示均差图
			pivoted(1);
		}
		if (kvs.inverted) { //反转
			inverted(1);
		}
		return preloader(false); //解屏,查询历史成交限频后不影响K线展示
	}

	s = (q > 0 ? "<span style='color:red;'>+" : "<span style='color:green;'>") + q + '</span>';
	if (Q['ownPrice']) {
		s += '[';
		s += (Q['curPrice'] > Q['ownPrice']) ? '高' : '低';
		s += abs(intval(Q['ownPrice'] - Q['curPrice']));
		s += ']';
	}
	$('#gap1').html(s);
};
task[2001] = function(s2c) { //获取交易账号响应
	for (let i in s2c.accList) {
		let a = s2c.accList[i];
		if (a['accStatus']) { //不要老的账户体系
			continue;
		}
		Z.accList.push(a);
	}
	if (in_array(O.pmode, [5])) { //复盘模式:逐日查看往期K线图,往期的不需要实时,需要交易账号查询历史成交以便打点
		for (let i in TrdMarkets) { //逐市场查询历史成交
			let trdMarket = intval(TrdMarkets[i]);
			if (in_array(trdMarket, G.Market['fills'])) {
				continue;
			}
			G.Market['fills'].push(trdMarket);
			return Z.Trd_GetHistoryOrderFillList(O.date + 9 * 60 * 60, O.date + 33 * 60 * 60, [], [], trdMarket); //当天9点到第二天9点.此接口限频:30秒10次
		}
	}
	in_array(Z.secMarket, [1]) || $('#w-container').hide(); //仅香港市场需要考虑牛熊证街货
	in_array(O.pmode, [1, 2, 3]) && Z.Trd_SubAccPush(TrdMarkets); //订阅交易推送
	in_array(O.pmode, [1, 2]) && in_array(Z.secMarket, [1]) && Z.Qot_GetWarrant(Q['owner_code'], { //第五步:获取牛熊证展示街货图
		'status': 1,
		'typeList': [3, 4],
		'streetMin': 0.001,
		'recoveryPriceMin': prefs.wYmin,
		'recoveryPriceMax': prefs.wYmax
	}, 0, 200, 25, true);
};
task[2222] = function(s2c) { //获取历史成交列表响应,只有复盘模式会来这里
	let ids = [];
	for (let i in s2c.orderFillList) {
		let a = s2c.orderFillList[i];
		a = array_merge(Z.stock(a.code, {
			part: true
		}), a);
		let id = unique(a.fillIDEx);
		window.Fills[id] = a;
		if (Q['owner_code'] != a.owner_code) { //仅关联的标的需要打点,如恒指牛熊证打到恒指期货上
			continue;
		}
		ids.push(id);
		G.fills[id] = a;
	}
	if (count(ids)) {
		showfills(kvs.showfills, false, ids);
	}
	for (let i in TrdMarkets) { //逐市场查询历史成交
		let trdMarket = intval(TrdMarkets[i]);
		if (in_array(trdMarket, G.Market['fills'])) {
			continue;
		}
		G.Market['fills'].push(trdMarket);
		return Z.Trd_GetHistoryOrderFillList(O.date + 9 * 60 * 60, O.date + 33 * 60 * 60, [], [], trdMarket); //当天9点到第二天9点.此接口限频:30秒10次
	}
};
task[3210] = function(s2c) { //获取牛熊证响应
	if(empty(s2c['warrantDataList'])){
		s2c['warrantDataList'] = [];
		s2c['lastPage'] = true;
	}
	G.nx += s2c['warrantDataList'].length;
	for (let i in s2c['warrantDataList']) {
		let a = s2c['warrantDataList'][i];
		if (in_array(a['status'], [1]) == false) {
			continue;
		}
		let k1 = 'K' + a['type']; //确保数组的顺序
		let k2 = 'K' + a['recoveryPrice'];
		if (empty(window.NX[k1])) {
			window.NX[k1] = [];
		}
		if (empty(window.NX[k1][k2])) {
			window.NX[k1][k2] = 0;
		}
		window.NX[k1][k2] += parseInt(l2s(a['streetVol']));
	}
	if (empty(s2c['lastPage'])) { //没取完:非最后一页
		return Z.Qot_GetWarrant(Q['owner_code'], {
			'status': 1,
			'typeList': [3, 4],
			'streetMin': 0.001,
			'recoveryPriceMin': prefs.wYmin,
			'recoveryPriceMax': prefs.wYmax
		}, G.nx, 200, 25, true);
	}
	if (s2c['allCount'] == 200) { //此接口限制最多200条
		alert('相关标的数量超过200条!');
	}
	let point = 0; //记录第几个点
	let list = [];
	for (let k1 in window.NX) {
		let type = k1.substr(1);
		for (let k2 in window.NX[k1]) {
			let recoveryPrice = parseFloat(k2.substr(1));
			list.push({
				'x': recoveryPrice,
				'value': window.NX[k1][k2]
			});
			if (type == 3) {
				window.NN.unshift([recoveryPrice, point]);
			}
			if (type == 4) {
				window.XX.push([recoveryPrice, point]);
			}
			point++;
		}
	}
	window.whart = anychart.column();
	whart.xScale('linear');
	Q['ownPrice'] = Q['ownPrice'] || Q['curPrice'];
	window.rmax = Q['ownPrice']; //用于判断牛熊证的回收
	window.rmin = Q['ownPrice'];
	//let label = whart.label(0);
	//label.useHtml(true);
	//label.position('right-top');
	//label.anchor('right-top');
	//label.offsetY(0);
	//label.offsetX(0);
	//label.selectable(true);
	//label.hAlign('left');
	//label.text("<span style='color:red;'>["+code+']当前报价:'+Q['ownPrice']+'</span>');
	window.weries = whart.column(list);
	weries.name('街货量');
	weries.stroke({
		thickness: 0
	});
	let weriesTooltip = weries.tooltip();
	weriesTooltip.format(function() {
		let s = '';
		s += '回收价:' + this.x + "\n";
		s += '街货量:' + bytes(this.value) + "\n";
		s += '距离价:' + sprintf('%.3f', (this.x - Q['ownPrice']));
		return s;
	});
	let ctl = whart.annotations();
	window.annotation20 = ctl.add({
		type: 'horizontal-line',
		color: 'rgba(255,0,0)',
		stroke: '2 rgba(255,0,0)',
		allowEdit: false,
		valueAnchor: floatval(Q['ownPrice'])
	});
	annotation20.yScale(whart.xScale());
	if (Q['owner_code'] != Q['origin_code']) {
		window.annotation21 = ctl.add({
			type: 'horizontal-line',
			color: 'rgba(0,128,0)',
			stroke: '2 rgba(0,128,0)',
			allowEdit: false,
			valueAnchor: floatval(Q['curPrice'])
		});
		annotation21.yScale(whart.xScale());
	}
	whart.container('w-container');
	$("#w-container").find("div[id]").hide();
	whart.yAxis(0).enabled(false);
	whart.xAxis(0).enabled(false);
	whart.xGrid(true);
	whart.yGrid(true);
	whart.isVertical(true);
	let customContextMenu = whart.contextMenu(); //鼠标右键
	customContextMenu.itemsProvider(function() {
		return [{
			text: 'Open AnyChart API',
			href: 'https://api.anychart.com'
		}];
	});
	customContextMenu.enabled(false);
	whart.xScale().minimum(prefs.wYmin);
	whart.xScale().maximum(prefs.wYmax);
	whart.xScale().ticks().interval(prefs.wickInterval);
	if (Q['secType'] == 3) {
		whart.yScale().minimum(0);
		whart.yScale().maximum(4 * 50 * 1000000);
		whart.yScale().ticks().interval(50 * 1000000);
	}
	if (Q['secType'] == 10) {
		whart.yScale().minimum(0);
		whart.yScale().maximum(4 * 100 * 1000000);
		whart.yScale().ticks().interval(100 * 1000000);
	}
	let padding = whart.padding();
	padding.top(0);
	padding.left(0);
	padding.right(0);
	padding.bottom(0);
	whart.title(false);
	whart.draw();
};
task[1004] = function(s2c) { //保活心跳
	//console.log(s2c);
};
task[3001] = function(s2c) { //订阅响应,获取origin_code-K线
	//console.log(s2c);
};
task[3007] = function(s2c) { //K线推送响应-这里一般每次只推送一根
	for (let i in s2c['klList']) {
		let a = s2c['klList'][i];
		if (s2c['security']['code'] == Q['owner_code']) {
			Q['ownPrice'] = a['closePrice'];
			if (window.whart) { //街货图已经就绪
				window.annotation20.valueAnchor(Q['ownPrice']);
				if (Q['ownPrice'] > window.rmax) { //往上涨了,判断熊
					window.rmax = Q['ownPrice'];
					for (let j in window.XX) {
						if (window.XX[j][0] > Q['ownPrice']) {
							break;
						}
						window.weries.getPoint(window.XX[j][1]).set('fill', 'red');
						window.whart.title(false);
						delete window.XX[j];
					}
				}
				if (Q['ownPrice'] < window.rmin) { //往下跌了,判断牛
					window.rmin = Q['ownPrice'];
					for (let j in window.NN) {
						if (window.NN[j][0] < Q['ownPrice']) {
							break;
						}
						window.weries.getPoint(window.NN[j][1]).set('fill', 'red');
						window.whart.title(false);
						delete window.NN[j];
					}
				}
			}
		}
		if (!in_array(s2c['security']['code'], [O.code, Q['origin_code']])) { //code和origin_code是一伙的
			continue;
		}
		if (empty(window.chart)) { //主图还未初始化...
			continue;
		}
		if (empty(window.scroller)) {
			continue;
		}

		let x = window.klines.at(-1); //最后那一根
		let y = window.klines.at(-2); //倒数第二根
		if (x && y && empty(a['lastClosePrice'])) { //如平台无此字段,则此处补上
			if (x[0] != a['timestamp'] * 1000) {
				a['lastClosePrice'] = x[4];
			}
			if (x[0] == a['timestamp'] * 1000) {
				a['lastClosePrice'] = y[4];
			}
		}

		let k = K(a);
		let removeFromStart = (x[0] >= k[0]) ? false : true;
		window.table.addData([k], removeFromStart); //如果是一根新的则要把最左边那根移出
		if (x[0] > k[0]) { //推了早于最后K线的数据
			continue;
		}
		if (removeFromStart) { //新的一根入栈
			window.klines.push(k);
		}
		if (window.annotation21) {
			window.annotation21.valueAnchor(a['closePrice']);
		}
		Q['curPrice'] = a['closePrice'];
		if (a['closePrice'] >= prefs.cYmax - 3 * prefs.tickInterval) { //增加展示空间,调整滚动条比例
			prefs.cYmax = ceil(a['closePrice'] / prefs.tickInterval) * prefs.tickInterval + 6 * prefs.tickInterval;
			chart.plot(0).yScale().minimum(prefs.cYmax - prefs.crange);
			chart.plot(0).yScale().maximum(prefs.cYmax);
			scroller.startRatio(1 - (prefs.crange / (prefs.cYmax - prefs.cYmin)));
			scroller.endRatio(1);
		}
		if (a['closePrice'] <= prefs.cYmin + 3 * prefs.tickInterval) {
			prefs.cYmin = floor(a['closePrice'] / prefs.tickInterval) * prefs.tickInterval - 6 * prefs.tickInterval;
			chart.plot(0).yScale().minimum(prefs.cYmin);
			chart.plot(0).yScale().maximum(prefs.cYmin + prefs.crange);
			scroller.startRatio(0);
			scroller.endRatio(prefs.crange / (prefs.cYmax - prefs.cYmin));
		}
		if (removeFromStart && kvs.showfills) { //重新定位打点
			showfills(false);
			showfills(true);
		}
		for (let positionSide = 0; positionSide <= 1; positionSide++) { //实时更新持仓盈利情况
			let p = Positions[positionSide][unique(Q['origin_code'])];
			if (empty(p) || empty(p['qty'])) {
				continue;
			}
			let diff = (a['closePrice'] - p['price']) * (p['positionSide'] ? -1 : 1) * Q['contractSize'];
			diff *= p['qty'];
			diff && ['plVal', 'td_plVal'].forEach(function(k, i, a) {
				let j = Fund[k] + diff;
				$('#trd_fund').find('.' + k).eq(0).css({
					'color': (j > 0 ? 'red' : (j < 0 ? 'green' : ''))
				}).text(format(j, 2));
			});
		}
		window.chart.title(false); //强制更新绘图
		let q = format(Q['curPrice'] - Q['lastClosePrice'], 3);
		if (in_array(O.pmode, [4])) { //简易图模式
			$('#tips').html((q > 0 ? '+' : '') + q);
			continue;
		}
		let s = (q > 0 ? "<span style='color:red;'>+" : "<span style='color:green;'>") + q + '</span>';
		if (Q['ownPrice']) {
			s += '[';
			s += (Q['curPrice'] > Q['ownPrice']) ? '高' : '低';
			s += abs(intval(Q['ownPrice'] - Q['curPrice']));
			s += ']';
		}
		$('#gap1').html(s);
	}
};
task[3011] = function(s2c) { //推送逐笔
	in_array(Z.trade, [92]) && Z.send(3011, { //推一份到前端仿真交易线程
		s2c: s2c
	}, 1);
	if (!in_array(s2c['security']['code'], [O.code, Q['origin_code']])) { //code和origin_code是一伙的
		return false;
	}
	for (let i in s2c['tickerList']) {
		let a = s2c['tickerList'][i];
		window.tickerList.push(a);
	}
	if (empty($._z_tickers)) { //把DOM节点缓存起来
		$._z_tickers = [];
		for (let i = 0; i <= 9; i++) {
			$._z_tickers[i] = [
				$(`#tickers tr:eq(${i}) td:eq(0)`),
				$(`#tickers tr:eq(${i}) td:eq(1)`),
				$(`#tickers tr:eq(${i}) td:eq(2)`)
			];
		}
	}
	let t = window.performance.now();
	if (t - G.tickertime >= 500) { //每N毫秒刷一次
		G.tickertime = t;
		window.tickerList = tickerList.slice(-10);
		for (let i = 0; i <= 9; i++) {
			let a = window.tickerList[i];
			if (empty(a)) {
				break;
			}
			$._z_tickers[i][0].text(date('H:i:s', a['timestamp'] + 60 * 0));
			$._z_tickers[i][1].text(a['price']);
			if (a['dir'] == 2) {
				$._z_tickers[i][2].text(`↓${bytes(l2s(a['volume']))}`).css('color', 'green');
			} else {
				$._z_tickers[i][2].text(`↑${bytes(l2s(a['volume']))}`).css('color', 'red');
			}
		}
	}
};
task[3013] = function(s2c) { //推送买卖盘
	let realtime = false; //判断是否实时摆盘
	if (s2c.svrRecvTimeAskTimestamp || s2c.svrRecvTimeBidTimestamp || (Z.qotMarket != 1)) { //只有港股有这两个字段
		realtime = true;
	}
	in_array(Z.trade, [92]) && realtime && Z.send(3013, {
		s2c: s2c
	}, 1); //推一份到前端仿真交易线程
	if (!in_array(s2c['security']['code'], [O.code, Q['origin_code']])) { //code和origin_code是一伙的
		return false;
	}
	if (empty($._z_bookers)) { //把DOM节点缓存起来
		$._z_bookers = [];
		for (let i = 0; i <= 9; i++) {
			$._z_bookers[i] = [
				[$(`#bookers tr:eq(${i}) td:eq(0) span:eq(0)`), $(`#bookers tr:eq(${i}) td:eq(0) span:eq(1)`)],
				[$(`#bookers tr:eq(${i}) td:eq(1) span:eq(0)`), $(`#bookers tr:eq(${i}) td:eq(1) span:eq(1)`)]
			];
		}
	}
	let t = window.performance.now();
	if (t - G.booktime >= 500) { //每N毫秒刷一次
		G.booktime = t;
		for (let i = 0; i <= 4; i++) { //5档摆盘
			let a = s2c['orderBookBidList'][i];
			let b = s2c['orderBookAskList'][i];
			if (empty(a) || empty(b)) {
				continue;
			}
			if (i == 0) { //买一卖一跨度
				$._z_bookers[i][0][0].text((b['price'] - a['price']).toFixed(3));
			}
			a['volume'] = a['volume'] ? bytes(l2s(a['volume'])) : '-';
			b['volume'] = b['volume'] ? bytes(l2s(b['volume'])) : '-';
			a['orederCount'] = a['orederCount'] ? a['orederCount'] : '-';
			b['orederCount'] = b['orederCount'] ? b['orederCount'] : '-';

			$._z_bookers[i + 1][0][0].text(a['price']);
			$._z_bookers[i + 1][0][1].text(`${a['volume']}(${a['orederCount']})`);

			$._z_bookers[i + 1][1][0].text(b['price']);
			$._z_bookers[i + 1][1][1].text(`${b['volume']}(${b['orederCount']})`);
		}
	}
};
task[2005] = function(s2c) { //解锁完成响应
};
task[2008] = function() { //订阅交易推送-响应
	for (let i in TrdMarkets) { //逐市场查询未完成订单
		let trdMarket = intval(TrdMarkets[i]);
		if (in_array(trdMarket, G.Market['order'])) {
			continue;
		}
		G.Market['order'].push(trdMarket);
		return Z.Trd_GetOrderList(trdMarket, true);
	}
};
task[2201] = function(s2c) { //查询未完成订单-响应
	for (let i in s2c.orderList) {
		let o = s2c.orderList[i];
		o = array_merge(Z.stock(o.code, {
			part: true
		}), o); //有些字段是错误的只能参考
		let id = unique(o.orderIDEx);
		o.id = id;
		o.price = floatval(o.price);
		o.remark = floatval(o.remark) ? floatval(o.remark) : o.price; //成本价放这个字段
		window.Orders[id] = o; //正股,衍生品,期货等所有订单都需要展示
		if (o.code == Q['origin_code']) { //本尊
			if (in_array(o.orderStatus, [0, 1, 2, 5, 10, 22]) && is_object(window.chart)) { //需要划线
				G.orders[id] = o; //仅展示自己的
				G.annotations[id] = G.ctrl.add(horizontal(o, false));
				selectAnnotation(id);
				if (in_array(o.trdSide, [2, 4])) { //平多/平空展示成本价线
					G.annotation2[id] = G.ctrl.add(horizontal(o, true));
				}
			}
		}
	}
	for (let i in TrdMarkets) { //逐市场查询今日订单
		let trdMarket = intval(TrdMarkets[i]);
		if (in_array(trdMarket, G.Market['order'])) {
			continue;
		}
		G.Market['order'].push(trdMarket);
		return Z.Trd_GetOrderList(trdMarket, true); //这里return确保每次只查询一个市场
	}
	for (let i in TrdMarkets) { //逐市场查询今日成交
		let trdMarket = intval(TrdMarkets[i]);
		if (in_array(trdMarket, G.Market['fills'])) {
			continue;
		}
		G.Market['fills'].push(trdMarket);
		return Z.Trd_GetOrderFillList(trdMarket, true);
	}
};
task[2211] = function(s2c) { //查询当日成交-响应
	let ids = [];
	for (let i in s2c.orderFillList) {
		let a = s2c.orderFillList[i];
		a = array_merge(Z.stock(a.code, {
			part: true
		}), a);
		let id = unique(a.fillIDEx);
		window.Fills[id] = a;
		if (Q['owner_code'] != a.owner_code) { //仅关联的标的需要打点,如恒指牛熊证打到恒指期货上
			continue;
		}
		ids.push(id);
		G.fills[id] = a;
	}
	if (count(ids)) {
		showfills(kvs.showfills, false, ids);
	}
	for (let i in TrdMarkets) { //逐市场查询今日成交
		let trdMarket = intval(TrdMarkets[i]);
		if (in_array(trdMarket, G.Market['fills'])) {
			continue;
		}
		G.Market['fills'].push(trdMarket);
		return Z.Trd_GetOrderFillList(trdMarket, true);
	}
	for (let i in TrdMarkets) { //逐市场查询持仓
		let trdMarket = intval(TrdMarkets[i]);
		if (in_array(trdMarket, G.Market['position'])) {
			continue;
		}
		G.Market['position'].push(trdMarket);
		return Z.Trd_GetPositionList(trdMarket, G.init == false);
	}
};
task[2102] = function(s2c) { //查询持仓-响应[每次订单更新都会来一轮]
	if (count(G.Market['position']) == 1) { //每轮第一次进来初始化,每次都是全量更新
		window.Positions = [
			[],
			[]
		];
	}
	let codes = []; //前端仿真模式需要订阅实时行情
	for (let i = count(s2c.positionList) - 1; i >= 0; i--) { //富途官方模拟交易没有合并持仓数据所以倒序
		if (G.widget == false) {
			//continue;
		}
		let p = s2c.positionList[i];
		if (empty(p.price)) { //异常
			continue;
		}
		p = array_merge(Z.stock(p.code, {
			part: true
		}), p, {
			positionSide: intval(p.positionSide)
		});
		let id = unique(p.code); //以code关联下标方便定位
		//let id = unique(p.positionID);
		p.id = id;
		p.curPrice = p.price;
		if (in_array(Z.trade, [92]) && !in_array(p.code, array_merge(G.codes, [Q['origin_code']]))) {
			G.codes.push(p.code);
			codes.push(p.code);
		}
		window.Positions[p.positionSide][id] = p; //所有持仓[含其他标的的,已经清仓的等]
		if (p.code != Q['origin_code']) { //非本尊
			continue;
		}
		if (p.qty && p.costPrice) {
			redoRemark(p.costPrice); //合并成本价划线
		}
		if (empty(p.canSellQty)) { //已经清仓
			continue;
		}
		if (in_array(p.secType, [10]) == false) { //仅期货进行自动挂单
			continue;
		}
		if (in_array(p.positionSide, [0, 1]) == false) { //0多头1空头
			continue;
		}
		let price = 0;
		if (p.positionSide == 0) { //多头卖出向上挂挡
			price = gear_up(max(p.costPrice, Q['curPrice']), array_first(Q['props']["fill"]), p.code);
			if (price >= Q['curPrice'] * 1.2) { //超出了富途挂单限制
				continue;
			}
		}
		if (p.positionSide == 1) {
			price = gear_down(min(p.costPrice, Q['curPrice']), array_first(Q['props']["fill"]), p.code);
			if (price <= Q['curPrice'] / 1.2) {
				continue;
			}
		}
		let trdSide = p.positionSide ? 4 : 2;
		let orders = []; //
		let lot = Q['lotSize'] * Q['props']['lots']; //单笔最大数量
		let canSellQty = abs(p.canSellQty); //剩余没挂单的
		price = calcPrice(price, trdSide); //逐档往上/下挂单
		for (let id in G.orders) { //查出同方向的单
			let o = structuredClone(G.orders[id]);
			if (o.code != p.code) {
				continue;
			}
			if (o.trdSide != trdSide) {
				continue;
			}
			if (in_array(o.orderStatus, [22])) { //canSellQty必须减去暂停的单
				canSellQty -= (o.qty - o.fillQty);
			}
			if (o.qty < lot) { //这个订单还能加量
				orders[id] = o;
			}
		}
		Top: while (canSellQty >= Q['lotSize']) { //逐档自动挂单
			for (let id in orders) { //把每个单凑满
				let o = structuredClone(orders[id]);
				let qty = min(canSellQty, lot - o.qty);
				o['qty'] += qty; //满上
				Z.Trd_ModifyOrder(o['orderIDEx'], 1, o['code'], o['trdSide'], o['qty'], o['price'], o['remark']);
				orders[id] = o; //更新
				if (o['qty'] >= lot) { //已满
					delete orders[id];
				}
				canSellQty -= qty;
				if (canSellQty < Q['lotSize']) {
					break Top;
				}
			}
			let qty = (canSellQty >= lot) ? lot : intval(canSellQty / Q['lotSize']) * Q['lotSize']; //单笔数量,避免碎股
			Z.Trd_PlaceOrder(p.code, trdSide, qty, price, p.costPrice, false);
			canSellQty -= qty;
			price = (trdSide == 2) ? gear_up(price, array_first(Q['props']["fill"]), p.code) : gear_down(price, array_first(Q['props']["fill"]), p.code);
		}
	}
	if (codes.length) { //订阅实时报价+摆盘+逐笔
		Z.Qot_Sub(codes, [1, 2, 4], true, true, [1], true);
	}
	for (let i in TrdMarkets) { //逐市场查询持仓
		let trdMarket = intval(TrdMarkets[i]);
		if (in_array(trdMarket, G.Market['position'])) {
			continue;
		}
		G.Market['position'].push(trdMarket);
		return Z.Trd_GetPositionList(trdMarket, G.init == false);
	}
	trd_show(false); //更新页面展示
	in_array(O.pmode, [3]) || buttons(true); //按钮可以启动了,所有订单操作都以持仓收尾
	if (G.init) {
		return true;
	}
	G.init = true; //初始化全面完成,打完收工
	if (Z.trdEnv) { //只有实盘需要解锁交易
		Z.Trd_UnlockTrade(true);
	}
	preloader(false); //解锁
	[1, 3, 7, 8].forEach(function(v, k, a) { //四个买入按钮
		$('#trd' + v).removeAttr('disabled');
		if (Z.trdEnv) { //实盘按钮显示红色
			$('#trd' + v).addClass('red');
		}
	});
	if (in_array(O.pmode, [3])) { //页面交易模式不需要后面的
		return true;
	}
	$(":input[name='locker']").click(function(e) { //锁屏复选框
		e.stopPropagation();
		$(this).blur();
		$(this).prop('checked', false);
		preloader(true);
	});
	$(document).contextmenu(function(e) { //禁止右键
		e.preventDefault();
	});
	$(document).keydown(function(e) { //快捷键:触发按键
		switch (e.keyCode) {
			case 32: { //space 空格键
				if (empty($('#btn8').attr('disabled'))) { //订单失效生效
					$('#btn8').click();
				}
				if (empty($('#btn9').attr('disabled'))) {
					$('#btn9').click();
				}
				break;
			}
			case 38: { //up
				$('#btn4').click(); //上移
				break;
			}
			//case 65:{ //A
			//}
			//case 68:{ //D
			//}
			case 37: { //left
			}
			case 39: { //right
				if (G.ctrlKey == true) { //强出
					$('#btn6').click();
				}
				if (G.ctrlKey == false) { //平出
					$('#btn10').click();
				}
				break;
			}
			case 40: { //down
				$('#btn5').click(); //下移
				break;
			}
			case 13: { //Enter
				break;
			}
			case 76: { //L
				if ($('#pwd').length == 0) { //锁屏
					preloader(true);
				}
				break;
			}
			case 86: { //V
				if (G.ctrlKey == false) {
					inverted(kvs.inverted ? false : true, true);
				}
				break;
			}
			case 83: { //S,选中下一个订单
				selectNextAnnotation(kvs.inverted ? 1 : -1);
				break;
			}
			case 87: { //W,选中上一个订单
				selectNextAnnotation(kvs.inverted ? -1 : 1);
				break;
			}
			case 17: { //Ctrl 按下控制键
				if (G.ctrlKey == false) {
					G.ctrlKey = true;
					buttons(!G.lock);
					$('#gap2').html("<span style='color:red;'>Ctrl</span>");
				}
				break;
			}
		}
	});
	$(document).keyup(function(e) { //快捷键:释放按键
		switch (e.keyCode) {
			case 17: { //Ctrl 释放控制键
				if (G.ctrlKey == true) {
					G.ctrlKey = false;
					buttons(!G.lock);
					$('#gap2').html('');
				}
				break;
			}
		}
	});
	$(document).click(function(e) { //超时锁屏,防止误碰
		G.activetime = window.performance.now();
		if (preloader()) {
			preloader(false);

			const themeColor = '#F44336';

			const contentHtml = `
			<div style="padding: 10px 5px;">
				<div style="display:flex; flex-direction:column; gap:10px; margin-bottom:15px;">
					<span style="color:#2c3e50; font-size:15px; font-weight:500;">请输入解锁密码:</span>
					<input type="text" class="pwd" required="required" autocomplete="new-password" id="pwd" 
						style="width: 100%; padding: 8px 12px; box-sizing: border-box; border: 1px solid #dcdfe6; border-radius: 4px; font-size: 14px; outline: none; transition: border-color 0.2s; -webkit-text-security: disc; text-security: disc;" />
				</div>
			</div>`;

			$('<div></div>').html(contentHtml).dialog({
				title: '系统消息',
				modal: true,
				width: 420,
				resizable: false,
				draggable: false,
				closeOnEscape: false,
				show: {
					effect: "fade",
					duration: 200
				},
				buttons: [{
						text: "确定",
						class: "btn-trading-confirm",
						click: function() {
							let $dlg = $(this);
							let $pwd = $dlg.find('.pwd');
							if ($pwd.val() === prefs.pwd) {
								preloader(false);
								$dlg.dialog("close");
							} else {
								$pwd.val('').css('border-color', themeColor).focus();
							}
						}
					},
					{
						text: "取消",
						class: "btn-trading-cancel",
						click: function() {
							$(this).dialog("close");
						}
					}
				],
				open: function() {
					const $dlg = $(this);
					const $pwdInput = $dlg.find('.pwd');
					setTimeout(() => {
						$pwdInput.focus();
					}, 50);
					$pwdInput.on('focus', function() {
						$(this).css('border-color', themeColor);
					});
					$pwdInput.on('click', e => e.stopPropagation());

					const $wrapper = $dlg.parent();
					$wrapper.css({
						"border": "none",
						"border-radius": "12px",
						"box-shadow": "0 20px 40px rgba(0,0,0,0.15)"
					});
					$wrapper.find('.ui-dialog-titlebar').css({
						"background": "#fff",
						"border": "none",
						"font-weight": "bold"
					});
					$wrapper.find('.ui-dialog-buttonpane').css({
						"border": "none",
						"text-align": "right",
						"padding-right": "20px"
					});
					$wrapper.find('button.btn-trading-confirm').attr('class', '').css({
						"background": themeColor,
						"color": "#fff",
						"border": "none",
						"padding": "6px 20px",
						"border-radius": "4px",
						"cursor": "pointer"
					});
					$wrapper.find('button.btn-trading-cancel').attr('class', '').css({
						"background": "#fff",
						"color": "#606266",
						"border": "1px solid #dcdfe6",
						"padding": "5px 20px",
						"border-radius": "4px",
						"cursor": "pointer",
						"margin-right": "10px"
					});
				},
				close: function() {
					if ($(this).find('.pwd').val() !== prefs.pwd) {
						preloader(true);
					}
					$(this).dialog('destroy').remove();
				}
			});
		}
	});
	if (kvs.inverted) { //反转
		inverted(1);
	}
};
task[2205] = function(s2c) { //修改订单-响应(改价+改量/失效/生效/撤单)(30秒20次,如果修改所有,orderIDEx为空)
};
task[2208] = function(s2c) { //推送订单更新
	if (empty(s2c.order)) {
		return false;
	}
	let o = s2c.order;
	o = array_merge(Z.stock(o.code, {
		part: true
	}), o);
	let id = unique(o.orderIDEx);
	o.id = id;
	o.price = floatval(o.price);
	o.remark = floatval(o.remark) ? floatval(o.remark) : o.price;
	if (o.code == Q['origin_code']) { //本尊
		if (in_array(o.orderStatus, [0, 1, 2, 5, 10, 22]) && is_object(window.chart)) { //需要划线
			G.orders[id] = o;
			if (G.annotations[id]) {
				if (G.annotations[id].valueAnchor() != o.price) {
					G.annotations[id].valueAnchor(o.price);
				}
				G.annotations[id].markers({
					type: in_array(o.orderStatus, [22]) ? 'diagonal-cross' : 'square'
				});
			} else {
				G.annotations[id] = G.ctrl.add(horizontal(o, false));
				selectAnnotation(id);
				if (in_array(o.trdSide, [2, 4])) { //平多/平空
					G.annotation2[id] = G.ctrl.add(horizontal(o, true));
				}
			}
		}
		if (in_array(o.orderStatus, [11, 14, 15, 21, 23, 24])) { //需要取消
			if (G.orders[id]) {
				delete G.orders[id];
			}
			if (G.annotations[id]) {
				G.ctrl.removeAnnotation(G.annotations[id]);
				delete G.annotations[id];
			}
			if (G.annotation2[id]) {
				G.ctrl.removeAnnotation(G.annotation2[id]);
				delete G.annotation2[id];
			}
			if (in_array(o.orderStatus, [14, 15]) && in_array(o.trdSide, [2, 4])) {}
		}
	}
	if (empty(o.lastErrMsg) == false) {
		alert(o.lastErrMsg);
	}
	window.Orders[id] = o;
	if (in_array(o.orderStatus, [15, 21, 23, 24])) {
		delete window.Orders[id];
	}
	window.clearTimeout(window.pt); //下单会触发多次+确保持仓缓存已更新+全部失效/生效/撤单等
	window.pt = window.setTimeout(function() {
		G.Market['position'] = []; //清锁
		for (let i in TrdMarkets) { //逐市场查询持仓
			let trdMarket = intval(TrdMarkets[i]);
			if (in_array(trdMarket, G.Market['position'])) {
				continue;
			}
			G.Market['position'].push(trdMarket);
			return Z.Trd_GetPositionList(trdMarket, G.init == false);
		}
	}, in_array(o.orderStatus, [2]) ? 500 : 500); //富途持仓接口有延迟
};
task[2218] = function(s2c) { //推送新成交,必然伴随着订单更新,即必然调用持仓,即必然会走持仓处的自动挂单
	if (empty(s2c.orderFill)) {
		return false;
	}
	let a = s2c.orderFill;
	a = array_merge(Z.stock(a.code, {
		part: true
	}), a);
	let id = unique(a.fillIDEx);
	a.id = id;
	window.Fills[id] = a;
	if (Q['owner_code'] != a.owner_code) { //非关联
		return true;
	}
	G.fills[id] = a;
	showfills(kvs.showfills, false, [id]);
};
task[2202] = function(s2c) { //下单-响应(30秒15次)
	//console.log(s2c);
};
task[3005] = function(s2c) { //实时报价推送
	in_array(Z.trade, [92]) && Z.send(3005, {
		s2c: s2c
	}, 1); //推一份到前端仿真交易线程
};
task[1004] = function(s2c) { //保活心跳
	//let time = l2s(s2c.time);
	if (empty(s2c.wk)) {
		return true;
	}
	if (window.performance.now() - G.activetime >= 60 * 60 * 1000) {
		if (in_array(O.pmode, [1, 2])) {
			preloader(true); //很久没动页面了
		}
	}
};
task[1003] = function(s2c) { //系统通知
	if (empty(s2c.wk)) {

	}
	if (s2c.type == -2) {
		let data = json_decode(s2c.event.desc);
		return alert('[后端推送]信息:' + data["desc"]);
	}
	if ((s2c.type == -1) && empty(s2c.wk) && in_array(O.pmode, [1])) { //借道行情连接:资讯及重大事件
		let gz = new Array();
		let y = date('Y');
		let m = date('n');
		let d = date('j');
		let o = P.GetGZ(y, m, d, date('G'), date('i'), date('s'));
		for (let i = 0; i <= 3; i++) {
			gz.push(P.ctg[o[0][i]] + P.cdz[o[1][i]]);
		}
		o = P.Solar2Lunar(y, m, d);
		let s = (o[3] ? '闰' : '') + P.dxy[o[1] - 1] + P.dxd[o[2] - 1];
		let w = P.GetWeek(y, m, d);
		s += ' 周' + P.wkd[w];
		s += ' [' + implode(' ', gz) + ']<br />';
		if (O.ISCLEAR) {
			s += "<span style='color:red;'>[今日结算]</span>";
		}
		if (O.ISCLOSE) {
			s += "<span style='color:red;'>[明天休市]</span>";
		}
		let data = json_decode(s2c.event.desc);
		if (O.ISTRADE) {
			let gi = parseInt(date('Gi'));
			if (((gi >= 1150) && (gi < 1200)) || ((gi >= 1550) && (gi < 1600))) {
				s += "[<span class='blink'>港股收盘</span>]";
			}
			if (((gi >= 1150) && (gi < 1200)) || ((gi >= 1620) && (gi < 1630))) {
				s += "[<span class='blink'>港期收盘</span>]";
			}
			if (((gi >= 1120) && (gi < 1130)) || ((gi >= 1450) && (gi < 1500))) {
				s += "[<span class='blink'>沪深收盘</span>]";
			}
			for (let i = 3; i <= 3; i++) {
				if (empty(data['gaps'][i])) {
					$('#gap' + i).html('');
				} else {
					$('#gap' + i).html((data['gaps'][i] >= 0 ? "<span style='color:red;'>+" : "<span style='color:green;'>") + data['gaps'][i] + '</span>');
				}
			}
		}
		for (let i in data['events']) {
			let a = data['events'][i];
			let b = a['event_timestamp'] - time();
			if (b <= 0) {
				continue;
			}
			let f = (b >= 0) && (b < 1800);
			s += '<br />' + (f ? "<span class='blink'>" : '') + date('H:i', a['event_timestamp']) + '[' + a['star'] + ']' + ' ' + substr(a['country'], 0, 0) + '' + substr(a['event_text'], 0, 15) + (f ? '</span>' : '');
		}
		$('#text').html(s);
		let f = $('#trd_news:hidden').length ? true : false; //还未初始化
		if (f) {
			$('#trd_news').css({
				'display': 'block'
			});
		}
		for (let i = data['news'].length - 1; i >= 0; i--) {
			let a = data['news'][i];
			let z = $('#trd_news').find("tr[class='news" + a['id'] + "']").length ? true : false; //之前有此条
			let s = "<tr style='color:" + (z || f ? 'black' : 'red') + ";' class='news" + a['id'] + "'>";
			s += "<td style='width:40px;'>" + date('H:i', a['time']) + '</td>';
			s += "<td style='white-space:nowrap;text-overflow:ellipsis;overflow:hidden;'>" + a['title'] + '</td>';
			s += '</tr>';
			$('#trd_news').prepend(s);
		}
		$('#trd_news').find("tr[class^='news']:gt(9)").each(function(i, n) {
			$(n).remove();
		});
	}
};
$(document).on('click', '.clipboard', function(e) {
	let $elm = $(this);
	let textToCopy = $elm.data('clipboard-text') || $elm.text();

	if (navigator.clipboard && window.isSecureContext) {
		navigator.clipboard.writeText(textToCopy).then(function() {
			let originalText = $elm.text();
			$elm.text('OK!').prop('disabled', true);

			window.setTimeout(function() {
				$elm.text(originalText).prop('disabled', false);
			}, 500);
		}).catch(function(e) {});
	}
});
$(function() {
	if (isset($_GET['pmode'])) {
		O.pmode = intval($_GET['pmode']); //从参数传过来
	}
	if (empty(O.pmode)) { //无需相关展示
		return true;
	}
	let ok = true; //URL参数验证
	if (!in_array(O.pmode, [1, 2, 3, 4, 5])) { //page mode 页面展示模式: 1综合交易模式;2面板交易模式;3页面交易模式;4简易图模式;5复盘模式
		ok = false;
		$_GET['pmode'] = 1;
	}
	if (isset($_GET['trdEnv'])) {
		O.trdEnv = intval($_GET['trdEnv']);
	}
	if (!in_array(O.trdEnv, [0, 1])) {
		ok = false;
		$_GET['trdEnv'] = 0;
	}
	if (isset($_GET['code'])) {
		O.code = trim($_GET['code']);
	}
	if (isset($_GET['klType'])) {
		O.klType = intval($_GET['klType']);
	}
	if (empty(KL2SUB[O.klType])) { //按照富途支持的K线进行规范
		ok = false;
		$_GET['klType'] = 1;
	}
	if (isset($_GET['day'])) {
		O.day = intval($_GET['day']);
	}
	if (in_array(O.pmode, [5]) && empty(isset($_GET['day']))) { //复盘模式必须指定日期
		ok = false;
		$_GET['day'] = 0;
	}
	if (in_array(O.pmode, [1, 2, 3, 4]) && isset($_GET['day'])) { //非复盘模式必须为当天
		ok = false;
		delete $_GET['day'];
	}
	let param = [];
	for (let key in $_GET) { //限定参数
		param.push(`${key}=${$_GET[key]}`);
		if (in_array(key, ['pmode', 'trdEnv', 'code', 'klType', 'day', '_t'])) {
			continue;
		}
		ok = false;
		delete $_GET[key];
	}
	if (empty(ok)) {
		return window.open(G.path + '?' + http_build_query(array_merge($_GET, {
			'code': O.code
		})), '_self');
	}
	sort(param);
	window.history.replaceState({}, '', G.path + (count(param) ? "?" : "") + implode("&", param)); //@符号还原
	position(true); //定位各元素
	preloader(true); //锁屏
	window.initdb().open().then(function() {
		return db.table("z-kvs").where("expire").between(1, time()).delete().then(function(n) {
			return db.table("z-kvs").each(function(a) {
				if (a.type == 1) {
					window.kvs[a.key] = a.value;
				}
			});
		}).then(function() {
			kvs.pivoted = boolval(kvs.pivoted); //是否显示均差图[否则为成交量图]
			$(":input[name='pivoted']").prop('checked', kvs.pivoted);
			kvs.inverted = boolval(kvs.inverted); //图例是否翻转
			$(":input[name='inverted']").prop('checked', kvs.inverted);
			kvs.showfills = boolval(kvs.showfills); //主图是否成交打点
			$(":input[name='showfills']").prop('checked', kvs.showfills);
			kvs.trd_show_select = intval(kvs.trd_show_select) || 5; //要查看的订单列表
			$('#trd_show_select').val(kvs.trd_show_select);
			in_array(O.pmode, [1, 2]) && window.setInterval(function() { //综合/面板交易模式显示电脑时间
				$('#tips').html(date('H:i:s'));
			}, 1000);
			window.Z = new ZHub();
			window.Q = Z.stock(O.code, { //统一到这个方法里面校正,注意这里是Z.stocks[O.code]的引用
				trdEnv: O.trdEnv,
				part: true,
				force: false
			});
			Z.uid = O.uid;
			Z.quote = Q['quote']; //行情来源:根据此值加载不同的行情Worker线程 0无;1富途的websocket服务;2自建富途代理;11天勤的websocket行情;21其他
			Z.trade = Q['trade']; //交易入口:根据此值加载不同的交易Worker线程 0无;1富途的websocket服务;2自建富途代理;11天勤的websocket交易;91自建后端仿真;92自建前端仿真;
			Z.tmode = Q['tmode']; //前端仿真成交模式trading mode:0无;1以实时报价进行成交[成交量不受控,只要价格到了就成交];2以买买盘和逐笔进行成交[最接近实战,但要求实时摆盘和实时逐笔];
			Z.trdEnv = Q['trdEnv'];
			Z.qotMarket = Q['qotMarket'];
			Z.trdMarket = Q['trdMarket'];
			Z.secMarket = Q['secMarket'];
			Z.calMarket = Q['calMarket'];
			Z.securityFirm = Q['securityFirm']; //账户所属券商:在获取交易账号处需要 0富途/自建模拟;1:富途证券(香港);2:moomoo证券(美国);3:moomoo证券(新加坡);4:moomoo证券(澳大利亚);101:天勤接口[自创]
			TrdMarkets = [Z.trdMarket];
			if (in_array(Z.secMarket, [1]) && !in_array(Z.trdMarket, [1])) {
				TrdMarkets.push(1); //港期要解决窝轮
			}
			Z.callback = function(c, n) {
				if (c['proto'] <= 0) {
					return alert('[请求异常]结果:' + c['retType'] + ";\n内容:" + c['retMsg'], {
						reload: in_array(c['retType'], [-1])
					});
				}
				if (c['retType'] < 0) {
					function_exists('buttons') && buttons(G.init);
					return alert('[响应异常]结果:' + c['proto'] + ';代码:' + intval(c['errCode']) + ';协议:' + c['proto'] + ";\n内容:" + (c['retMsg'] ? c['retMsg'] : ''), {
						reload: (++G.alert >= 8)
					});
				}
				let cb = resp || task;
				if (empty(cb[c['proto']])) {
					return console.log(c);
				}
				cb[c['proto']](c['s2c']);
			};
			Z.start();
			if (in_array(O.pmode, [5])) { //复盘需要键盘支持
				$(document).keydown(function(e) {
					let day = false;
					switch (e.keyCode) {
						case 32: { //space
							break;
						}
						case 37: { //left
						}
						case 65: { //A
							day = 0;
							break;
						}
						case 38: { //up
						}
						case 87: { //W
							day = O.day + 1;
							break;
						}
						case 39: { //right
						}
						case 68: { //D
							day = rand(0, 356);
							break;
						}
						case 40: { //down
						}
						case 83: { //S
							if (O.day) {
								day = O.day - 1;
							}
							break;
						}
						case 13: { //Enter
							day = rand(0, 356);
							break;
						}
						case 86: { //V
							inverted(kvs.inverted ? false : true, true);
							break;
						}
						case 98: //小键盘区的2
						case 104: { //小键盘区的8
							let list = [];
							let next = in_array(e.keyCode, [98]) ? +1 : -1; //向下浏览
							window.db.table("z-stocks").each(function(a) {
								list.push({
									code: a['code'],
									sort: a['sort'] || 0
								});
							}).then(function() {
								list.sort(function(a, b) { //从大到小排列
									return b.sort - a.sort;
								});
								for (let k = 0; k < list.length; k++) {
									if (list[k]['code'] != Q.code) {
										continue;
									}
									list[k + next] && window.open(G.path + '?' + http_build_query(array_merge($_GET, {
										'code': list[k + next]['code']
									})), '_self')

									break;
								}
							});
							break;
						}
						default: {
							//console.log(e.keyCode)
						}
					}
					is_int(day) && window.open(G.path + '?' + http_build_query(array_merge($_GET, {
						'day': day
					})), '_self');
				});
			}
		});
	}).catch(function(e) {
		console.log(e.stack || e);
	}).finally(function() {});
});