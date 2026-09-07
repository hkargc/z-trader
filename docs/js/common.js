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
/**
 * 本系统全局变量 $GLOBALS 已在 locutus.min.js 中定义
 * @type type
 */
$GLOBALS.G = {
	isWidget: (navigator.userAgent.indexOf("FutuNN_PC") != -1),
	isWindow: (typeof window === 'object' && window !== null),
	path: self.location ? parse_url(location.href, 'PHP_URL_PATH') : "",
	unique: ['bogus'], //用于生成自增ID,从1开始
	booktime: 0, //用于摆盘刷新频率
	tickertime: 0, //用于逐笔刷新频率
	activetime: 0, //页面最后点击时间
	preloader: null, //加载层
	nx: 0, //牛熊证数量
	id: null, //最后一次选中的订单划线ID
	alert: 0, //页面出现过的alert数量,超额则重载页面
	init: false, //是否完成了初始化
	ctrl: null, //画线控制台
	ctrlKey: false, //ctrl键监控
	lock: false, //交易正在处理中
	codes: [], //需要实时订阅的
	fills: [], //当前code对应的成交
	orders: [], //当前code对应的订单
	groups: [ //成交分类,用于成交打点处
		[],
		[],
		[],
		[]
	], //成交打点
	annotations: [], //对应订单的水平画线
	annotation2: [], //成本价画线
	Market: { //用于获取订单/成交/持仓的锁定处
		'order': [],
		'fills': [],
		'position': []
	}
};
/**
 * 从页面传过来或者程序计出来的关于当前标的的一些资料
 * @type type
 */
$GLOBALS.O = Object.assign({
	pc: 0, //0窄版持仓;1宽版持仓
	uid: 1, //仿真交易用户ID
	day: 0, //往前数第几个交易日,复盘模式会用到
	code: '00700',
	klType: 1, //K线类型,受限于KL2SUB
	pmode: 0, //page mode 页面展示模式: 0无任何功能;1综合交易模式;2面板交易模式;3页面交易模式;4简易图模式;5复盘模式
	date: mktime(0, 0, 0), //往前数第day个交易日的0点,在初始化后会重新计算此值
	trdEnv: 0, //交易环境:0仿真交易;1实盘交易;
	ISCLEAR: false, //今天是否恒指期货结算日
	ISTRADE: false, //今天是否开盘
	ISCLOSE: true //明天是否休市
}, $GLOBALS.O);
/**
 * 当前code资料[是Z.stocks[O.code]的引用] 由 z.hub.js 的stock生成
 * @type type
 */
$GLOBALS.Q = {};
/**
 * 图例的设置
 * @type type
 */
$GLOBALS.prefs = {
	pwd: 'public', //屏幕加载层解锁密码
	cticks: 0, //一屏的网格线数量[根据屏幕大小动态计算]
	cpoints: 0, //一屏的K线数量
	cYmin: 0, //K线图Y轴最小刻度
	cYmax: 0,
	crange: 0,
	tickInterval: 1, //步长:每yGrid能涵盖的价格范围
	wticks: 0, //牛熊街货图网格线数量
	wpoints: 0,
	wYmin: 0, //牛熊街货图Y轴最小刻度
	wYmax: 0,
	wrange: 0,
	wickInterval: 0, //牛熊街货图步长
	left: 0, //主图左边空间
	right: 0, //主图右边空间(要展示滚动条则设为20)
	vh: 80 //主图成交量区高度volume height[不显示成交量则设为0]
};
$GLOBALS.Z = {}; //ZHub对象
$GLOBALS.db = {}; //Dexie存储器
$GLOBALS.kvs = {}; //key-value-storage
$GLOBALS.chart = null; //主图
$GLOBALS.table = null; //主图anychart的数据仓
$GLOBALS.series = null; //主图上的K线,翻转处用到
$GLOBALS.scroller = null; //主图滚动条
$GLOBALS.computer = null; //自创的均差指标线[与成交量图共用一个区域]
$GLOBALS.eventMarkers = {}; //主图成交打点
$GLOBALS.klines = null; //K线数组,用于图表区域选择
$GLOBALS.trades = null; //交易日期数组,用于复盘选择
$GLOBALS.TrdMarkets = []; //需要订阅的交易市场
$GLOBALS.Fills = []; //所有标的成交
$GLOBALS.Orders = []; //所有标的订单
$GLOBALS.Positions = [ //所有标的持仓,含多头空头
	[],
	[]
];
$GLOBALS.Fund = {}; //账户资金
$GLOBALS.tickerList = []; //逐笔
$GLOBALS.whart = null; //窝轮街货图
$GLOBALS.rmax = 0; //用于判断牛熊证的回收
$GLOBALS.rmin = 0; //用于判断牛熊证的回收
$GLOBALS.weries = null; //窝轮街货图柱子
$GLOBALS.NN = []; //牛熊证街货图用到
$GLOBALS.XX = [];
$GLOBALS.NX = [];
$GLOBALS.annotation20 = null; //窝轮街货图价格指示
$GLOBALS.annotation21 = null;
$GLOBALS.tt = 0; //窗口缩放延时
$GLOBALS.pt = 0; //获取持仓延时
$GLOBALS.task = null; //系统的响应回调
$GLOBALS.resp = null; //自定义响应回调
/**
 * 港股最低上落价位(非最新版): [min, max, 每档跨度] min <= x < max
 * @type Array
 */
$GLOBALS.Gear = [
	[10, 250, 1], // >=0.01 && <0.25  每档 0.001
	[250, 10000, 5], // >=0.25 && <10.0  每档 0.005
	[10000, 20000, 20], // >=10.0 && <20.0  每档 0.020
	[20000, 100000, 50], // >=20.0 && <100.0 每档 0.050
	[100000, 200000, 100], // >=100.0 && <200.0 每档 0.100
	[200000, 500000, 200], // >=200.0 && <500.0 每档 0.200
	[500000, 1000000, 500], // >=500.0 && <1000.0 每档 0.500
	[1000000, 2000000, 1000], // >=1000.0 && <2000.0 每档 1.000
	[2000000, 5000000, 2000], // >=2000.0 && <5000.0 每档 2.000
	[5000000, 99995000, 5000] // >=5000.0 && <99995.0 每档 5.000
];
/**
 * K线类型对应的订阅类型 [富途的订阅类型, K线名称, 周期(单位为分钟)]
 * 天勤支持日内任意周期,可以按需修改此数组
 * @type type
 */
$GLOBALS.KL2SUB = {
	1: [11, '1分K', 1], //一分K
	2: [6, '日K', 24 * 60], //日K
	//3: [12, '周K', 7 * 24 * 60], //周K
	//4: [13, '月K', 30 * 24 * 60], //月K
	//5: [16, '年K', 365 * 24 * 60], //年K
	6: [7, '5分K', 5], //五分K
	7: [8, '15分K', 15], //15分K
	8: [9, '30分K', 30], //30分K
	9: [10, '小时K', 60], //小时K
	10: [17, '三分K', 3], //三分K
	//11: [15, '季度K', 90 * 24 * 60] //季度K
	12: [18, '十分K', 10], //十分K
	13: [19, '两小时K', 2 * 60], //两小时K
	14: [20, '三小时K', 3 * 60], //三小时K
	15: [21, '四小时K', 4 * 60] //四小时K
};
/**
 * 订单状态
 * @type type
 */
$GLOBALS.OrderStatus = {
	0: '未提交',
	1: '等待提交',
	2: '提交中',
	5: '等待成交',
	10: '部分成交',
	11: '全部成交',
	14: '部分完成', //剩余部分已撤单
	15: '已撤单',
	21: '下单失败',
	22: '失效',
	23: '已删除',
	24: '已撤销'
};
/**
 * 订单方向
 * @type type
 */
$GLOBALS.TrdSide = {
	1: '开多', //多头
	2: '平多',
	3: '开空', //空头
	4: '平空'
};
/**
 * 用dialog@jquery-ui重写alert - Gemini代工
 * @param {string} message - 消息内容
 * @param {object} options - { type: 'success'|'error'|'info', url: '跳转地址', reload: 是否重载页面 }
 */
function alert(message, options) {
	if (empty(G.isWindow)) { //非可视窗口:比如在Worker中
		console.log(message);
		return true;
	}
	options = Object.assign({}, options);
	const themes = {
		success: {
			color: '#4CAF50',
			icon: 'M22 11.08V12a10 10 0 1 1-5.93-9.14M22 4L12 14.01l-3-3'
		},
		error: {
			color: '#F44336',
			icon: 'M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z M12 9v4 M12 17h.01'
		},
		info: {
			color: '#2196F3',
			icon: 'M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z M12 16v-4 M12 8h.01'
		}
	};
	const theme = themes[options.type] || themes.error;
	const duration = 60000;
	const contentHtml = `
		<div style="padding: 10px 5px;">
			<div style="display:flex; align-items:flex-start; gap:15px; margin-bottom:20px;">
				<svg width="42" height="42" viewBox="0 0 24 24" fill="none" stroke="${theme.color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					<path d="${theme.icon}"></path>
				</svg>
				<div style="color:#2c3e50; font-size:15px; line-height:1.5; font-weight:500; flex:1;">
					${message}
				</div>
			</div>
			<div style="width:100%; height:3px; background:#f0f0f0; border-radius:2px; overflow:hidden;">
				<div id="alert-pbar" style="width:100%; height:100%; background:${theme.color}; transition: width linear;"></div>
			</div>
		</div>
	`;
	$('<div></div>').html(contentHtml).dialog({
		title: '系统消息',
		modal: true,
		width: 420,
		resizable: false,
		draggable: false,
		show: {
			effect: "fade",
			duration: 200
		},
		buttons: [{
			text: "确定",
			class: "btn-trading-confirm",
			click: function() {
				$(this).dialog("close");
			}
		}],
		open: function() {
			const $dlg = $(this);
			$('#alert-pbar').css('transition-duration', duration + 'ms').css('width', '0%');
			const timer = window.setTimeout(() => {
				if ($dlg.is(':data(ui-dialog)')) {
					$dlg.dialog('close');
				}
			}, duration);
			$dlg.data('timer', timer);
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
				"background": theme.color,
				"color": "#fff",
				"border": "none",
				"padding": "6px 20px",
				"border-radius": "4px",
				"cursor": "pointer"
			});
		},
		close: function() {
			window.clearTimeout($(this).data('timer'));
			$(this).dialog('destroy').remove();
			if (options.reload) {
				return window.location.reload();
			}
			if (typeof(options.url) === 'string' && options.url.length) {
				return window.location.href = options.url;
			}
		}
	});
}
/**
 * 初始化Dexie对象: https://github.com/dexie/Dexie.js
 * @returns Dexie
 */
function initdb() {
	if (db instanceof Dexie) {
		return db;
	}
	db = new Dexie("z-trader"); //由 $GLOBALS.db 定义
	db.version(1).stores({
		'z-kvs': '&key,expire', //key - value - storage 一些中间数据
		'z-users': '&uid', //用户资金表,当前只有一条
		'z-orders': '&orderIDEx,uid', //订单表
		'z-stocks': '&code', //富途的股票.美股/沪深/港股的代码暂不冲突
		'z-symbols': '&instrument_id' //大陆期货标的列表
	});
	return db;
}
/**
 * 根据页面显示模式定位各元素
 * @param {type} f 是否初始化首次调用
 * @returns {Boolean}
 */
function position(f) {
	if (empty(G.isWindow)) { //非可视窗口
		return true;
	}
	if (empty($('#k-container').length)) {
		return true;
	}
	let height = $(window).height(); //所有展示需结合css,程序只进行定位
	let width = $(window).width();
	if (O.pmode == 1) { //page mode 综合交易模式:左边是图右边是页面交易区
		$('#k-container').css({ //主图:K线图区域
			"display": "block",
			"height": height,
			"width": width * 65 / 100 - 1
		});
		$('#w-container').css({ //窝轮街货图
			"display": "block",
			"height": height
		});
		$('#tips').css({ //主图右上角时钟/价变
			"display": "flex",
			"width": "100px",
			"left": $('#k-container').width() - 100
		});
		$('#p-container').css({ //盘口数据:买卖十档,实时逐笔
			"display": "block"
		});
		$('#gap').css({ //主图左上角显示
			"display": "flex",
			"width": "200px",
			"border-left": "0px",
			"border-right": "0px solid green",
			"font-weight": "normal",
			"font-size": "14px",
			"color": "green",
			"left": "0px",
			"height": "180px",
			"justify-content": "flex-start"
		});
		$("#text").css({ //主图重要事件
			"left": "800px",
			"display": "block"
		});
		[1, 2, 3, 4].forEach(function(i, key, a) { //主图左下角
			$('#gap' + i).css({
				"display": "block"
			});
			$('#opt' + i).css({
				"display": "block"
			});
		});
		$('#trader').css({ //页面交易区
			"display": "block",
			"height": height,
			"width": width * 35 / 100,
			"left": width * 65 / 100
		});
	}
	if (O.pmode == 2) { //面板交易模式:整个页面是一个图
		$('#k-container').css({
			"display": "block",
			"height": height,
			"width": width
		});
		$('#w-container').css({
			"display": "block",
			"height": height
		});
		$('#tips').css({
			"display": "flex",
			"width": "100px",
			"left": $('#k-container').width() - 100
		});
		$('#gap').css({
			"display": "flex",
			"width": "200px",
			"border-left": "0px",
			"border-right": "0px solid green",
			"font-weight": "normal",
			"font-size": "14px",
			"color": "green",
			"left": "0px",
			"height": "180px",
			"justify-content": "flex-start"
		});
		$('#p-container').css({
			"display": "block"
		});
		$("#text").css({
			"left": "800px",
			"display": "block"
		});
		[1, 2, 3, 4].forEach(function(i, key, a) {
			$('#gap' + i).css({
				"display": "block"
			});
			$('#opt' + i).css({
				"display": "block"
			});
		});
	}
	if (O.pmode == 3) { //页面交易模式:整个页面是HTML
		$('#trader').css({
			"display": "block",
			"height": height,
			"width": width
		});
	}
	if (O.pmode == 4) { //简易图模式:单个图
		prefs.vh = 0; //不显示成交量
		$('#k-container').css({
			"display": "block",
			"height": height,
			"width": width
		});
		$('#tips').css({
			"display": "flex",
			"width": "100px",
			"left": $('#k-container').width() - 100
		});
		$('#gap').css({
			"display": "flex",
			"width": "200px",
			"border-left": "0px",
			"border-right": "1px solid green",
			"font-weight": "normal",
			"font-size": "14px",
			"color": "green",
			"left": "0px",
			"height": "180px",
			"justify-content": "flex-start"
		});
	}
	if (O.pmode == 5) { //复盘模式
		prefs.right = 20; //显示滚动条
		$('#k-container').css({
			"display": "block",
			"height": height,
			"width": width
		});
		$('#gap').css({
			"display": "flex",
			"width": "200px",
			"border-left": "0px",
			"border-right": "1px solid green",
			"font-weight": "normal",
			"font-size": "14px",
			"color": "green",
			"left": "0px",
			"height": "180px",
			"justify-content": "flex-start"
		});
		$("#buttons").css({
			"display": "block",
			"left": (width - 250) / 2
		});
		$("#buttons button").css({
			"color": O.trdEnv ? "red" : "black"
		});
	}
	let cticks = (($('#k-container').height() - prefs.vh) / 40); //每40px一根,主图一共可展示多少根Y轴网格线[yGrid],这个值可能带小数点
	let cpoints = intval(($('#k-container').width() - prefs.left - prefs.right) / 6); //每6px一根,主图可展示多少根K线,这个值不能带小数点
	if (window.chart && window.scroller && (cpoints <= prefs.cpoints)) { //如页面缩小则图例同步
		chart.plot(0).height($('#k-container').height() - prefs.vh); //蜡烛图
		chart.selectRange('points', cpoints, false);
		if (O.day && window.klines[60] && window.klines[60 + prefs.cpoints]) { //复盘模式会来这里
			chart.selectRange(klines[60][0], klines[60 + prefs.cpoints][0], false);
		}
		let plotBounds = chart.getPixelBounds();
		let yAxisBounds = chart.plot(0).yAxis().getPixelBounds();
		window.scroller.parentBounds(0, yAxisBounds.top + 5, plotBounds.width, yAxisBounds.height - 10);
		prefs.crange = prefs.tickInterval * cticks;
		let calcMin = floor((Q['curPrice'] - prefs.crange / 2) / prefs.tickInterval) * prefs.tickInterval;
		let calcMax = calcMin + prefs.crange;
		chart.plot(0).yScale().minimum(calcMin);
		chart.plot(0).yScale().maximum(calcMax);
		prefs.cYmin = min(prefs.cYmin, calcMin);
		prefs.cYmax = max(prefs.cYmax, calcMax);
		scroller.startRatio((calcMin - prefs.cYmin) / (prefs.cYmax - prefs.cYmin));
		scroller.endRatio((calcMax - prefs.cYmin) / (prefs.cYmax - prefs.cYmin));
		if (window.whart) { //街货图
			prefs.wrange = prefs.wickInterval * ($('#w-container').height() / 40);
			prefs.wYmax = prefs.wYmin + prefs.wrange;
			whart.xScale().minimum(prefs.wYmin);
			whart.xScale().maximum(prefs.wYmax);
		}
	} else { //如页面放大则重新加载
		empty(f) && window.location.reload();
	}
	if (empty(f)) { //非首次调用
		return true;
	}
	prefs.cticks = cticks; //记录此值在K线数组初始化时要用到
	prefs.cpoints = cpoints;
	window.addEventListener('resize', function(e) { //如放大/缩小了浏览器则重新定位
		window.clearTimeout(window.tt); //窗口缩放延时
		window.tt = window.setTimeout(function() {
			position(false);
		}, 250);
	}, false);
}
/**
 * 根据配置计算手续费.有的是固定手续费,有的是按比例算
 * @param {type} price 当前价格
 * @param {type} code main_code origin_code 均可
 * @returns {Number}
 */
function fees(price, code) {
	let a = [0, 0, 0]; //开仓手续费,平今手续费,合计手续费
	if (empty(Z)) {
		return a;
	}
	let _o = Z.stock(code, {
		part: true
	});
	if (empty(_o)) {
		return a;
	}
	a[0] = (_o['props']['fees'][0] >= 1 ? _o['props']['fees'][0] : price * _o['contractSize'] * _o['props']['fees'][0]).toFixed(2) * 1;
	a[1] = (_o['props']['fees'][1] >= 1 ? _o['props']['fees'][1] : price * _o['contractSize'] * _o['props']['fees'][1]).toFixed(2) * 1;
	a[2] = (a[0] * 1 + a[1] * 1).toFixed(2) * 1;
	return a;
}
/**
 * 向上计算挂挡.先默认按港股标准计算.再判断如果是期货则采纳接口数据
 * @param {type} p price 从此价格开始计算
 * @param {type} step 挂高多少档.0为修正到规范价位
 * @returns {Number}
 */
function gear_up(p, step, code) {
	p = +bcmul(p, 1000, 0); //高精度算术由locutus.js实现
	outter: for (; step >= 0; step--) {
		if (p < Gear[0][0]) {
			break;
		}
		for (let i = 0; i < Gear.length; i++) {
			let v = Gear[i];
			if ((p >= v[0]) && (p < v[1])) {
				let q = ceil(p / v[2]) * v[2]; //计算到最近的一个合法档位
				if (p != q) { //进行了一次修正
					p = q;
					if (step <= 1) {
						break outter;
					}
					break;
				}
				if (step == 0) { //仅修正
					break outter;
				}
				p = q + v[2];
				if (step <= 1) {
					break outter;
				}
				break;
			}
		}
	}
	p = +bcdiv(p, 1000, 3);
	if (empty(Z)) {
		return p;
	}
	let _o = Z.stocks[code];
	if (empty(_o)) {
		return p;
	}
	if (_o.secType == 10) { //期货的档位是系统指定
		if (empty(_o.minVar)) {
			return p;
		}
		return (ceil(arguments[0] / _o.minVar) * _o.minVar + _o.minVar * arguments[1]).toFixed(3) * 1;
	}
	if (in_array(_o.qotMarket, [21, 22])) { //沪深正股,固定0.01每档
		if (empty(_o.minVar)) {
			_o.minVar = 0.01;
		}
		return (ceil(arguments[0] / _o.minVar) * _o.minVar + _o.minVar * arguments[1]).toFixed(3) * 1;
	}
	return p;
}
/**
 * 向下计算挂挡
 * @param {type} p price 从此价格开始计算
 * @param {type} step 挂低多少档.0为修正到规范价位
 * @returns {Number}
 */
function gear_down(p, step, code) {
	p = +bcmul(p, 1000, 0);
	outter: for (; step >= 0; step--) {
		if (p < Gear[0][0]) {
			break;
		}
		for (let i = 0; i < Gear.length; i++) {
			let v = Gear[i];
			if ((p >= v[0]) && (p < v[1])) {
				let q = floor(p / v[2]) * v[2];
				if (p != q) {
					p = q;
					if (step <= 1) {
						break outter;
					}
					break;
				}
				if (step == 0) {
					break outter;
				}
				let a = q - v[2];
				let b = q - (i ? Gear[i - 1][2] : 0);
				p = (a >= v[0]) ? a : b;
				if (step <= 1) {
					break outter;
				}
				break;
			}
		}
	}
	p = +bcdiv(p, 1000, 3);
	if (empty(Z)) {
		return p;
	}
	let _o = Z.stocks[code];
	if (empty(_o)) {
		return p;
	}
	if (_o.secType == 10) { //期货的档位是系统指定
		if (empty(_o.minVar)) {
			return p;
		}
		return (floor(arguments[0] / _o.minVar) * _o.minVar - _o.minVar * arguments[1]).toFixed(3) * 1;
	}
	if (in_array(_o.qotMarket, [21, 22])) { //沪深正股,固定0.01每档
		if (empty(_o.minVar)) {
			_o.minVar = 0.01;
		}
		return (floor(arguments[0] / _o.minVar) * _o.minVar - _o.minVar * arguments[1]).toFixed(3) * 1;
	}
	return p;
}
/**
 * 格式化K线
 * @param {type} a
 * @returns {Array}
 */
function K(a) {
	return [a['timestamp'] * 1000,
		a['openPrice'],
		a['highPrice'],
		a['lowPrice'],
		a['closePrice'],
		l2s(a['volume']),
		a['turnover'], //成交额
		a['turnoverRate'], //换手率
		a['lastClosePrice'] ? round(a['closePrice'] - a['lastClosePrice'], 2) : '--', //涨跌额
		a['lastClosePrice'] ? round((a['closePrice'] - a['lastClosePrice']) / a['lastClosePrice'] * 100, 2) + '%' : '--', //涨跌幅
		(a['closePrice'] <= a['openPrice']) ? 'green' : 'red'
	];
}
/**
 * 规范小数点位数
 * @param {type} number
 * @param {type} digits
 * @returns {String}
 */
function format(number, digits) {
	return (new Intl.NumberFormat('en-IN', {
		maximumFractionDigits: digits ?? 2,
		minimumFractionDigits: digits ?? 2,
		notation: 'standard'
	})).format(number);
}
/**
 * 
 * @param {type} n
 * @returns {Number|String}
 */
function bytes(n) {
	let c = abs(n);
	if (c >= 1000000) {
		return intval(n / 1000000) + 'M';
	} else if (c >= 1000) {
		return intval(n / 1000) + 'K';
	} else {
		return isNaN(n) ? 0 : n;
	}
}
/**
 * 
 * @param {type} n
 * @returns {String}
 */
function HKD(n) {
	if (n >= 100000000) {
		return intval(n / 100000000) + '亿';
	} else if (n >= 10000) {
		return intval(n / 10000) + '万';
	} else if (n >= 1000) {
		return intval(n / 1000) + '千';
	} else {
		return intval(n / 1);
	}
}
/**
 * Long to String 超大数值对象转字串
 * https://github.com/dcodeIO/long.js
 * https://github.com/protobufjs/protobuf.js
 * @param {type} o
 * @returns {unresolved}
 */
function l2s(o) {
	if (is_object(o) && isset(o.low) && isset(o.high) && isset(o.unsigned)) {
		return Long.fromBits(o.low, o.high, o.unsigned).toString();
	}
	return o;
}
/**
 * 生成从1开始的唯一ID[由于订单ID等为Long类型不便处理]
 * @param {type} id
 * @returns Number
 */
function unique(id) {
	let j;
	id = l2s(id);
	for (let i in G.unique) {
		if (G.unique[i] == id) {
			j = intval(i);
			break;
		}
	}
	if (empty(j)) {
		j = G.unique.push(id);
		j = j - 1;
	}
	return j;
}
/**
 * 提交订单.供页面交易区调用
 */
function trd_submit() {
	if (empty(G.isWindow)) { //非可视窗口
		return true;
	}
	let id = $("#buy_id").val();
	let qty = $('#buy_qty').val() * $("#buy_lot").val();
	let price = $('#buy_price').val();
	let o = window.Orders[id];
	if (empty(o)) { //下单
		let code = $("#buy_code").val();
		code = trim(code);
		if (empty(Z.stocks[code])) { //没有按步骤来
			return false;
		}
		let trdSide = $('#buy_trdSide').val();
		trdSide = intval(trdSide);
		let remark = '';
		let positionSide = in_array(trdSide, [1, 2]) ? 0 : 1;
		if (in_array(trdSide, [2, 4])) { //对于平多/平空,尽可能找出成本价
			for (let i in window.Positions[positionSide]) {
				let p = window.Positions[positionSide][i];
				if (p.code == code) {
					remark = p.costPrice;
				}
			}
		}
		Z.Trd_PlaceOrder(code, trdSide, qty, price, remark, true);
	} else { //改单:改价格或数量
		Z.Trd_ModifyOrder(o["orderIDEx"], 1, o['code'], o['trdSide'], qty, price, o['remark']);
	}
	$("#buy").dialog("close");
}
/**
 * 修改订单:改状态.供页面交易区调用
 * @param {type} id
 * @param {type} op 2撤单3失效4生效
 * @returns {Boolean}
 */
function trd_modify(id, op) {
	if (empty(G.isWindow)) { //非可视窗口
		return true;
	}
	let o = window.Orders[id];
	if (empty(o)) { //查无此单
		return false;
	}
	if (in_array(op, [2, 3, 4]) == false) {
		return false;
	}
	Z.Trd_ModifyOrder(o["orderIDEx"], op, o['code'], o['trdSide'], o['qty'], o['price'], o['remark']);
}
/**
 * 逐档改变订单价格,点击'+'/'-'按钮.供页面交易区调用
 * @param {type} direction 0加1减
 * @param {type} id
 * @returns {Boolean}
 */
function trd_price(direction, id) {
	if (empty(G.isWindow)) { //非可视窗口
		return true;
	}
	let o = window.Orders[id];
	if (empty(o)) { //查无此单
		return false;
	}
	if (in_array(direction, [0, 1]) == false) {
		return false;
	}
	if (empty(Z)) { //没有按步骤来
		return false;
	}
	let _o = Z.stocks[o.code];
	if (empty(_o)) {
		return false;
	}
	let step = G.ctrlKey ? array_last(_o["props"]["gear"]) : array_first(_o["props"]["gear"]); //根据CTRL键是否触发选择不同步长
	let price = (kvs.inverted == direction) ? gear_up(o['price'], step, o.code) : gear_down(o['price'], step, o.code); //根据图例是否翻转确定方向
	Z.Trd_ModifyOrder(o["orderIDEx"], 1, o['code'], o['trdSide'], o['qty'], price, o['remark']);
}
/**
 * 根据单量计算总价.供页面交易区调用
 * @returns {undefined}
 */
function trd_calc() {
	if (empty(G.isWindow)) { //非可视窗口
		return true;
	}
	let qty = intval($('#buy_qty').val());
	let lot = intval($("#buy_lot").val());
	let c = intval($('#buy_price').val() * 1000) * qty * lot / 1000;
	$('#buy_total').text(format(c, 2) + "(" + bytes(qty * lot) + ")");
}
/**
 * 展示购买窗口.供页面交易区调用
 * @param {type} code
 * @param {type} trdSide 开多/平多/开空/平空
 * @param {type} type 证券类型:0正股/期货1认购2认沽3牛证4熊证
 * @param {type} id 改单时的订单ID
 * @returns {Boolean}
 */
function trd_dialog(code, trdSide, type, id) {
	if (empty(G.isWindow)) { //非可视窗口
		return true;
	}
	if (id && window.Orders[id]) {
		code = Orders[id]['code'];
		trdSide = Orders[id]['trdSide'];
	}
	code = trim(code);
	if (in_array(trdSide, [1, 2, 3, 4]) == false) {
		return false;
	}
	type = intval(type);
	if (empty(code)) {
		let key = "trd_codes:" + type;
		kvs[key] = array_values(kvs[key] ?? []);
		code = array_first(kvs[key]);
	}
	$("#buy_code").val(code);
	$("#buy_name").text('');
	$("#buy_price").val('');
	$("#buy_select").empty();
	$("#buy_qty").val('');
	$("#buy_lotsize").text('');
	$('#buy_total').text('');
	$("#buy_lot").val(0);
	$("#buy_total").val('');
	$("#buy_trdSide").val(trdSide);
	$("#buy_id").val(id ? id : '-1');
	$("#buy_submit").val(window.TrdSide[trdSide]);
	code && trd_getinfo();
	if (!$("#buy").dialog("instance")) {
		$("#buy").dialog({
			width: "320",
			buttons: [],
			resizable: false,
			closeOnEscape: true,
			autoOpen: false,
			modal: false,
			position: {
				my: "center top",
				at: "center top",
				of: $('#trader').length ? "#trader" : $(window)
			}
		});
	}
	if (!$("#buy").dialog("isOpen")) {
		$("#buy").dialog("open");
	}
	$("#buy_code").focus();
	$("#trd_codes").empty();
	$("#trd_codes").append("<option value=''>选择</option>");
	if (in_array(trdSide, [2, 4])) {
		return true;
	}
	if (id) {
		return true;
	}
	let key = "trd_codes:" + type;
	kvs[key] = array_values(kvs[key] ?? []);
	for (let i in kvs[key]) { //选择框
		let c = kvs[key][i];
		$("#trd_codes").append("<option value='" + c + "'>" + c + "</option>");
	}
}
/**
 * 获取某标的资料.供页面交易区调用
 * @returns {Boolean}
 */
function trd_getinfo() {
	if (empty(G.isWindow)) { //非可视窗口
		return true;
	}
	let code = trim($("#buy_code").val());
	$("#buy_code").val('');
	$("#buy_name").text('');
	$("#buy_price").val('');
	$("#buy_select").empty();
	$("#buy_lotsize").text('');
	$("#buy_lot").val('');
	$("#buy_qty").val('');
	$('#buy_total').text('');
	if (empty(code)) {
		return false;
	}
	if (empty(Z)) {
		return false;
	}
	let _o = Z.stock(code, { //这里隐藏了一次后台3202请求.这里是引用
		part: true,
		force: true
	});
	Z.Qot_GetSecuritySnapshot([code], [], function(o) { //这里有限频
		if (empty(o.s2c) || empty(o.s2c.snapshotList)) {
			return $("#buy_name").text('不存在该股!');
		}
		let a = array_first(o.s2c.snapshotList);
		if (a && a['basic'] && a['basic']['security'] && a['basic']['security']['code']) {
			let code = a['basic']['security']['code'];
			if (empty(_o['curPrice']) && Z.stocks[_o['main_code']]) {
				_o['curPrice'] = Z.stocks[_o['main_code']]['curPrice'];
			}
			if (a['basic']['curPrice']) { //其实就是为了拿这三个字段
				_o['curPrice'] = a['basic']['curPrice'] * 1; //变量作用域
			}
			if (a['basic']['askPrice']) {
				_o['askPrice'] = a['basic']['askPrice'] * 1;
			}
			if (a['basic']['bidPrice']) {
				_o['bidPrice'] = a['basic']['bidPrice'] * 1;
			}
			if (empty(_o['curPrice'])) {
				return $("#buy_name").text('不支持该方式!');
			}
			if (empty(_o.askPrice)) { //计算买一卖一
				_o.askPrice = max(gear_up(_o.bidPrice ?? _o.curPrice, 1, _o.code), _o.curPrice);
			}
			if (empty(_o.bidPrice)) {
				_o.bidPrice = min(gear_down(_o.askPrice ?? _o.curPrice, 1, _o.code), _o.curPrice);
			}
			$("#buy_code").val(_o.origin_code);
			$("#buy_name").text(_o.name);
			$("#buy_select").append("<option value='" + _o.askPrice + "'>卖一:" + _o.askPrice + "</option>");
			$("#buy_select").append("<option value='" + _o.curPrice + "'>市价:" + _o.curPrice + "</option>");
			$("#buy_select").append("<option value='" + _o.bidPrice + "'>买一:" + _o.bidPrice + "</option>");
			$("#buy_lotsize").text('(' + _o.lotSize + '/手)');
			$("#buy_lot").val(_o.lotSize);
			let id = $("#buy_id").val();
			let buy_price = 0;
			let buy_qty = 0;
			if (id && window.Orders[id]) { //修改
				buy_price = Orders[id]["price"];
				buy_qty = Orders[id]["qty"];
			} else { //下单
				if ($('#buy_trdSide').val() == 2) { //平多
					buy_price = _o.askPrice;
					for (let i in Positions[0]) { //富途模拟交易系统中,一个code对应多个持仓
						let a = Positions[0][i];
						if (a['code'] == _o.origin_code) {
							buy_qty += intval(a['canSellQty']);
						}
					}
				} else {
					buy_price = _o.bidPrice;
					buy_qty = (_o.secType == 5) ? 20 * _o.lotSize : 1 * _o.lotSize;
				}
			}
			$("#buy_qty").val(buy_qty / _o.lotSize);
			$("#buy_price").val(buy_price);
			$("#buy_select").val(buy_price);
			trd_calc();
			let key = "trd_codes:" + intval(_o.type); //0正股3牛4熊
			window.kvs[key] = array_values(kvs[key] ?? []);
			array_unshift(kvs[key], _o.origin_code);
			kvs[key] = array_unique(kvs[key]);
			kvs[key] = array_values(kvs[key] ?? []);
			kvs[key] = array_slice(kvs[key], 0, 8);
			window.db.table("z-kvs").put({ //存起来以便下次放到选择列表
				type: 1,
				key: key,
				value: kvs[key],
				expire: 0
			});
		}
	});
}
/**
 * 在页面交易区展示持仓和订单,计算盈利情况.供页面交易区调用
 * @param {type} trigger 是否从下拉列表中改变了订单展示类型
 * @returns {Boolean}
 */
function trd_show(trigger) {
	if (empty(G.isWindow)) { //非可视窗口
		return true;
	}
	if (empty($('#trader:visible').length)) { //页面交易没打开
		return false;
	}
	$('#trd_position').find('tr').each(function(i, n) { //全量更新
		if (i == 0) { //第一行是表头
			return true;
		}
		$(n).remove();
	});
	$('#trd_order').find('tr').each(function(i, n) {
		if (i == 0) {
			return true;
		}
		$(n).remove();
	});
	window.Fund = Object.assign(Fund, {
		uptime: time(),
		plVal: 0,
		td_plVal: 0,
		new_heji: 0
	});
	let Paused = { //各方向失效的单
		1: {},
		2: {},
		3: {},
		4: {}
	};
	let Status = {
		0: [0, 1, 2, 5, 10, 11, 14, 15, 21, 22, 23, 24], //全部
		5: [0, 1, 2, 5, 10, 22], //待成交
		11: [11, 14], //已成交
		22: [22] //失效
	};
	let trd_show_select = intval($("#trd_show_select").val());
	trigger && db.table("z-kvs").put({
		type: 1,
		key: 'trd_show_select',
		value: trd_show_select,
		expire: 0
	});
	let list;
	list = structuredClone(Orders); //展示订单
	list.sort(function(a, b) { //如果图像翻转则订单显示也翻转:按挂单价格排序
		if (trd_show_select != 5) { //不是关注待成交状态则按时间顺序排列
			return (a.updateTimestamp - b.updateTimestamp);
		}
		return (kvs.inverted ? -1 : +1) * ((a.price - b.price) || (a.id - b.id) /** || (a.orderStatus - b.orderStatus) || (a.updateTimestamp - b.updateTimestamp)**/ );
	});
	for (let i in list) {
		let a = list[i];
		if (a['orderStatus'] == 22) { //暂停的单
			if (empty(Paused[a['trdSide']][a['code']])) {
				Paused[a['trdSide']][a['code']] = 0;
			}
			Paused[a['trdSide']][a['code']] += intval(a['qty']);
		}
		if (in_array(a['orderStatus'], Status[trd_show_select]) == false) { //不在所关注状态列表
			continue;
		}
		if (isset(Q['owner_code']) && (a.owner_code != Q['owner_code'])) { //非相关
			//continue;
		}
		if (in_array(O.pc, [0]) && in_array(a['secType'], [3]) && (a.owner_code != Q['owner_code'])) { //窄版仅展示涡轮+期货+关联正股
			//continue;
		}
		if (in_array(O.pc, [1]) && in_array(a['secType'], [5, 10])) { //宽版仅展示正股
			continue;
		}
		let name = '';
		if (a['secType'] == 5) { //涡轮/牛熊
			name = substr(a['name'], 6, 1);
		} else { //正股/期货
			name = substr(a['name'], 0, 4);
		}
		let s = '';
		s += '<tr id="order' + a['id'] + '"' + (in_array(a['orderStatus'], [22]) ? ' class="red"' : '') + '>'; //暂停的单标红
		s += '<td>' + window.OrderStatus[a['orderStatus']] + '</td>';
		s += '<td>' + window.TrdSide[a['trdSide']] + '</td>';
		s += '<td class="clipboard" onclick="function_exists(\'selectAnnotation\') && selectAnnotation(' + a['id'] + ');" data-clipboard-text="' + a['code'] + '">' + a['code'] + '</td>'; //选中K线图中对应的订单
		if (in_array(a['orderStatus'], [0, 1, 2, 5, 10, 22])) { //待成交的单可以修改价格或手数
			s += '<td title="' + a['name'] + '"><a href=\'javascript:trd_dialog("' + a['code'] + '","' + a['trdSide'] + '",0,"' + a['id'] + '")\'>' + name + '</a></td>';
			s += '<td><input type="button" value="↓" onclick="trd_price(1,\'' + a['id'] + '\')"/>' + format(a['price'], 3) + '<input type="button" value="↑" onclick="trd_price(0,\'' + a['id'] + '\')"/>';
		} else {
			s += '<td title="' + a['name'] + '">' + name + '</td>';
			s += '<td>' + format(a['price'], (a['secType'] == 10) ? 0 : 3) + '</td>';
		}
		s += '<td>' + bytes(a['qty']) + '</td>';
		s += '<td>' + bytes(a['fillQty']) + '@' + format(floatval(a['fillAvgPrice']), 3) + '</td>';
		if (in_array(a['orderStatus'], [0, 1, 2, 5, 10])) { //待成交的单可以修改状态
			s += '<td><a href="javascript:trd_modify(\'' + a['id'] + '\', 3)">失效</a></td><td><a href="javascript:trd_modify(\'' + a['id'] + '\', 2)">撤单</a></td>';
		} else if (in_array(a['orderStatus'], [22])) {
			s += '<td><a href="javascript:trd_modify(\'' + a['id'] + '\', 4)">生效</a></td><td><a href="javascript:trd_modify(\'' + a['id'] + '\', 2)">撤单</a></td>';
		} else {
			s += '<td></td><td></td>';
		}
		s += '<td>' + date(O.pc ? "Y-m-d H:i:s" : "H:i:s", a['updateTimestamp']) + '</td>';
		s += '</tr>';
		if ($('#order' + a['id']).length) {
			$('#order' + a['id']).replaceWith(s);
		} else {
			$('#trd_order tr:eq(0)').after(s);
		}
	}
	list = structuredClone(Positions); //深拷贝.展示持仓
	for (let i in list) {
		for (let j in list[i]) {
			let a = list[i][j];
			if (isset(Q['owner_code']) && (a.owner_code != Q['owner_code'])) { //非相关
				//continue;
			}
			if (in_array(O.pc, [0]) && in_array(a['secType'], [3]) && (a.owner_code != Q['owner_code'])) { //窄版仅展示涡轮+期货+关联正股
				//continue;
			}
			if (in_array(O.pc, [1]) && in_array(a['secType'], [5, 10])) { //宽版仅展示正股
				continue;
			}
			let name = '';
			if (a['secType'] == 5) {
				name = substr(a['name'], 6, 1);
			} else {
				name = substr(a['name'], 0, 4);
			}
			let trdSide = a.positionSide ? 4 : 2; //空头看平空
			a['canSellQty'] -= intval(Paused[trdSide][a['code']]);
			if (Q['origin_code'] && (Q['origin_code'] == a.code)) { //更新到最新价格
				a['curPrice'] = Q['curPrice'];
				let diff = (a['curPrice'] - a['price']) * (a['positionSide'] ? -1 : 1) * a['contractSize'];
				a['val'] = a['curPrice'] * a['qty'];
				a['plVal'] += diff * a['qty'];
				a['td_plVal'] += diff * a['qty'];
				Positions[i][j]['price'] = a['curPrice']; //更新到最新价格
			}
			Fund["plVal"] += a['plVal'];
			Fund["td_plVal"] += floatval(a['td_plVal']);
			let f = (a['plVal'] > 0) ? 1 : (a['plVal'] < 0 ? -1 : 0); //盈亏
			let tdf = (a['td_plVal'] > 0) ? 1 : (a['td_plVal'] < 0 ? -1 : 0); //今日盈亏
			let s = '';
			s = '<tr id="position' + a['positionSide'] + a['id'] + '">';
			s += '<td class="clipboard" data-clipboard-text="' + a['code'] + '">' + a['code'] + '</td>';
			s += '<td title="' + a['name'] + '">' + name + '</td>';
			s += '<td>' + (intval(a['positionSide']) ? "空" : "多") + '</td>';
			s += '<td>' + bytes(a['qty']) + '@' + format(a['curPrice'], 3) + '</td>';
			s += '<td data-qty="' + a['canSellQty'] + '">' + bytes(a['canSellQty']) + '</td>';
			s += '<td>' + format(a['costPrice'], 4) + '</td>';
			s += '<td>' + format(a['val'], 2) + '</td>';
			s += '<td style="color:' + (f == 1 ? 'red' : (f == -1 ? 'green' : '')) + '">' + (f == 1 ? '+' : '') + sprintf('%.2f', floatval(a['plRatio']) * 100) + '%</td>';
			if (O.pc) {
				s += '<td style="color:' + (f == 1 ? 'red' : (f == -1 ? 'green' : '')) + '">' + (f == 1 ? '+' : '') + format(a['plVal'], 2) + '</td>';
			}
			s += '<td style="color:' + (tdf == 1 ? 'red' : (tdf == -1 ? 'green' : '')) + '">' + (tdf == 1 ? '+' : '') + format(floatval(a['td_plVal']), 2) + '</td>';
			if (O.pc) {
				s += '<td>' + format(floatval(a['td_trdVal']), 2) + '</td>';
				s += '<td>' + format(floatval(a['td_buyQty']), 0) + '@' + format(floatval(a['td_buyVal']) / max(1, floatval(a['td_buyQty'])), 3) + '</td>';
				s += '<td>' + format(floatval(a['td_sellQty']), 0) + '@' + format(floatval(a['td_sellVal']) / max(1, floatval(a['td_sellQty'])), 3) + '</td>';
			}
			if (a['positionSide']) {
				s += a['canSellQty'] ? '<td><a href="javascript:trd_dialog(\'' + a['code'] + '\',4,0);">平空</a></td>' : "<td></td>";
			} else {
				s += a['canSellQty'] ? '<td><a href="javascript:trd_dialog(\'' + a['code'] + '\',2,0);">平多</a></td>' : "<td></td>";
			}
			s += '</tr>';
			if ($('#position' + a['positionSide'] + a['id']).length) { //每次都是先清空,这里不会来的
				$('#position' + a['positionSide'] + a['id']).replaceWith(s);
			} else {
				$('#trd_position tr:eq(0)').after(s);
			}
		}
	}
	list = structuredClone(Fills); //通过成交计算手续费
	for (let i in list) {
		let a = list[i];
		if (isset(Q['owner_code']) && (a.owner_code != Q['owner_code'])) { //非相关
			//continue;
		}
		if (a['secType'] != 3) {
			//continue;
		}
		if (a['secType'] == 5) {}
		if (in_array(a['secType'], [10])) {
			let k = in_array(a['trdSide'], [1, 3]) ? 0 : 1;
			let c = fees(a.price, a.code);
			Fund["new_heji"] += (c[k] * a['qty']);
		}
		if (in_array(a['secType'], [3, 5])) {
			let z = a['qty'] * a['price'];
			Fund["new_heji"] += max(3, 0.0003 * z); //佣金	每笔订单 交易金额的0.03%，最低3.00 港元（免佣期内不收取）
			Fund["new_heji"] += 15.0; //平台使用费	每笔订单 15港元
			Fund["new_heji"] += 0; //交易系统使用费
			Fund["new_heji"] += 0.000042 * z; //交收费	每笔成交 交易金额的0.0042%
			Fund["new_heji"] += in_array(a['secType'], [3]) ? ceil(0.0010 * z) : 0; //印花税	每笔成交 交易金额的0.13%，不足一元作一元计,买卖窝轮、牛熊证时，此项费用不收取
			Fund["new_heji"] += max(0.01, 0.0000565 * z); //交易费	每笔成交 交易金额的0.00565%，最低0.01港元
			Fund["new_heji"] += max(0.01, 0.000027 * z); //证监会交易征费	每笔成交 交易金额的0.0027%，最低0.01港元
			Fund["new_heji"] += 0.000015 * z; //财务汇报局交易征费	每笔成交 交易金额的0.0015%
		}
	}
	Fund["td_plVal"] -= Fund["new_heji"]; //盈亏扣除手续费
	for (let i in Fund) {
		let j = Fund[i];
		if (in_array(i, ['plVal', 'td_plVal', 'new_heji'])) {
			$('#trd_fund').find("." + i).eq(0).css({
				"color": (j > 0 ? 'red' : (j < 0 ? 'green' : ''))
			}).text(format(j, 2));
			continue;
		}
		if (i == 'uptime') {
			j = date("H:i:s", j);
		}
		if (in_array(i, ['cash', 'marketVal', 'costVal'])) {
			j = format(j, 2);
		}
		$('#trd_fund').find("." + i).eq(0).text(j);
	}
}
/**
 * 划线下单.供图表交易按钮调用
 * @param {type} trdSide 1开多;3开空
 * @param {type} force 抢多抢空,强制执行:抢高一档,即刻生效
 * @returns {Boolean}
 */
function PlaceOrder(trdSide, force) {
	if (empty(G.isWindow)) { //非可视窗口
		return true;
	}
	if (in_array(trdSide, [1, 3]) == false) {
		return false;
	}
	let price = 0;
	let step = array_first(Q['props']["fill"]); //开仓时比报价低几个档:挂买一单/买二单/...
	if (trdSide == 1) { //开多
		if (force) { //抢多
			price = gear_up(Q['curPrice'], step, Q['code']); //比市价高N档:最坏的情况下会高吃N档!!!卖盘密集的情况下是优先低价成交
		} else {
			price = gear_down(Q['curPrice'], step, Q['code']); //比市价低N档
		}
	}
	if (trdSide == 3) { //开空
		if (force) { //抢空
			price = gear_down(Q['curPrice'], step, Q['code']); //比市价低N档:最坏的情况下...
		} else {
			price = gear_up(Q['curPrice'], step, Q['code']);
		}
	}
	if (empty(price)) {
		return false;
	}
	let annotation = getSelectedAnnotation(); //传参或选中的线
	if (empty(annotation) == false) { //如果选中了一个订单,则改单
		let id = annotation.zIndex();
		let o = G.orders[id];
		if (o.trdSide == trdSide) { //方向匹配
			if (price != o.price) { //价格变化
				Z.Trd_ModifyOrder(o["orderIDEx"], 1, o['code'], o['trdSide'], o["qty"], price, o['remark']);
			}
			if (force && in_array(o.orderStatus, [22])) { //强买强沽强制生效
				Z.Trd_ModifyOrder(o["orderIDEx"], 4, o['code'], o['trdSide'], o['qty'], price, o['remark']);
			}
			return true;
		}
	}
	let qty = Q['lotSize'] * Q['props']['lots']; //下单特定手数.来自z.hub.js和config.js
	force = force || array_last(Q['props']['fill']); //如果非 强买/强沽 按钮,则按config.js
	price = force ? price : calcPrice(price, trdSide); //逐档挂单: 强买/强沽 则按市价+1档,否则逐档挂单
	Z.Trd_PlaceOrder(Q['origin_code'], trdSide, qty, price, '', force || G.ctrlKey); //最后的倔强:如果按住了CTRL键则下生效单
}
/**
 * 划线修改订单:撤单/失效/生效.供图表交易按钮调用.
 * @param {type} modifyOrderOp
 * @returns {Boolean}
 */
function ModifyOrder(modifyOrderOp, id) {
	if (empty(G.isWindow)) { //非可视窗口
		return true;
	}
	if (in_array(modifyOrderOp, [2, 3, 4]) == false) {
		return false;
	}
	let list = [];
	let forAll = boolval(G.ctrlKey); //按住CTRL键则为改变所有订单
	let annotation = getSelectedAnnotation(id); //选中的订单
	if (empty(annotation) && empty(forAll)) {
		return false;
	}
	if (empty(forAll)) { //必然选中了一个
		let o = G.orders[annotation.zIndex()];
		if (empty(o)) { //此处异常
			return false;
		}
		if ((modifyOrderOp == 3) && (o.orderStatus == 22)) { //已经是失效状态无需更改
			return false;
		}
		if ((modifyOrderOp == 4) && (o.orderStatus != 22)) { //
			return false;
		}
		list[o.id] = o;
	}
	let count = G.ctrl.getAnnotationsCount();
	for (let index = count - 1; index >= 0; index--) {
		if (empty(forAll)) { //改单个
			break;
		}
		let annotation = G.ctrl.getAnnotationAt(index);
		if (empty(annotation)) { //不厌其烦,再多的过滤都不为过
			continue;
		}
		if (annotation.getType() != 'horizontal-line') {
			continue;
		}
		let o = G.orders[annotation.zIndex()];
		if (empty(o)) {
			continue;
		}
		if ((modifyOrderOp == 3) && (o.orderStatus == 22)) { //已经是失效状态无需更改
			continue;
		}
		if ((modifyOrderOp == 4) && (o.orderStatus != 22)) { //
			continue;
		}
		list[o.id] = o;
	}
	list.sort(function(a, b) { //离当前价最近的最先执行
		return abs(a['price'] - Q['curPrice']) - abs(b['price'] - Q['curPrice']);
	});
	for (let id in list) {
		let o = list[id];
		Z.Trd_ModifyOrder(o["orderIDEx"], modifyOrderOp, o['code'], o['trdSide'], o['qty'], o['price'], o['remark']);
	}
}
/**
 * 平出 的时候预留多少档.争取平手续费.供图表交易按钮调用
 * @param {type} o 一个订单对象
 * @returns {Number}
 */
function calcRemark(o) {
	if (empty(G.isWindow)) { //非可视窗口
		return true;
	}
	let remark = 0; //乘以1为强制转数字
	if (in_array(o.trdSide, [4])) { //格式化到标准价位
		remark = gear_down(o.remark * 1, 0, o.code);
	}
	if (in_array(o.trdSide, [2])) { //格式化到标准价位
		remark = gear_up(o.remark * 1, 0, o.code);
	}
	if (empty(remark)) { //没有计算到成本价:比如其他客户端下的单
		return o.price;
	}
	let step = 1; //默认一个点作为手续费
	let minVar = o['minVar'] * o['contractSize'] * 1; //每档价值
	if (minVar) {
		let a = fees(o.price, o.code);
		step = ceil(a[2] / minVar);
	}
	let f = o['minVar'] * step;
	if (in_array(o.trdSide, [2])) { //平多
		f *= +1;
	}
	if (in_array(o.trdSide, [4])) { //平空
		f *= -1;
	}
	return remark + f;
}
/**
 * 根据订单信息生成水平线[订单线或成本价线]
 * @param {boolean} remark 是否成本价线
 */
function horizontal(o, remark) {
	if (empty(G.isWindow)) { //非可视窗口
		return true;
	}
	let dash = ['10 10', '10 10', '0 0', '10 10', '0 0']; //虚线,0为成本价线
	let color = ['rgba(148,0,211)', 'rgba(255,0,0)', 'rgba(255,0,0)', 'rgba(0,100,0)', 'rgba(0,100,0)']; //颜色,0为成本价颜色
	let index = remark ? 0 : o.trdSide;
	return {
		type: "horizontal-line", //水平划线
		zIndex: o.id,
		normal: {
			stroke: {
				color: color[index],
				dash: dash[index],
				thickness: remark ? 1 : 2
			}
		},
		hovered: { //鼠标悬停样式
			stroke: {
				color: color[index],
				dash: dash[index],
				thickness: remark ? 1 : 4
			}
		},
		selected: { //选中样式
			stroke: {
				color: color[index],
				dash: dash[index],
				thickness: remark ? 1 : 4
			}
		},
		markers: { //划线上的标记,暂停的订单打叉
			type: in_array(o.orderStatus, [22]) ? "diagonal-cross" : "square",
			enabled: remark ? false : true,
			size: 8
		},
		allowEdit: remark ? false : true, //通过拖动进行改单
		valueAnchor: remark ? o.remark : o.price
	};
}
/**
 * 面板按钮展示控制
 * @param {type} f
 * @returns {undefined}
 */
function buttons(f) {
	if (empty(G.isWindow)) { //非可视窗口
		return true;
	}
	if (empty(window.chart)) {
		return true;
	}
	if (empty(Z)) {
		return true;
	}
	if (empty(Z.trade)) { //无需交易
		return true;
	}
	let b = []; //初始化时是锁定状态
	G.lock = !f;
	if (f) {
		let c = []; //counter
		let t = []; //status
		let annotation = getSelectedAnnotation(); //选中的订单
		let o = empty(annotation) ? {} : G.orders[annotation.zIndex()];
		$("tr[id^=order]").each(function() { //页面区订单也要选中
			let me = ($(this).attr("id").replace("order", "") == o.id);
			$(this).css({
				"background-color": me ? "#E9E9E9" : "#FFFFFF"
			});
		});
		let cost = false; //是否展示平出
		for (let id in G.orders) {
			let g = G.orders[id];
			c[0] = intval(c[0]) + 1; //订单总数(各方向各状态)
			c[g.trdSide] = intval(c[g.trdSide]) + 1;
			t[g.orderStatus] = intval(t[g.orderStatus]) + 1;
			if (G.ctrlKey && empty(cost) && in_array(g.trdSide, [2, 4])) {
				cost = (g.orderStatus == 22) || (g.price != calcRemark(g));
			}
		}
		let id = unique(Q['origin_code']);
		let m = Positions[0][id] && Positions[0][id]["qty"] ? false : true; //"无"多头持仓
		let n = Positions[1][id] && Positions[1][id]["qty"] ? false : true; //"无"空头持仓
		if (c[0]) { //有单
			let z = ((c[0] < Q['props']['maxq']) && empty(c[3]) && empty(c[4])) || (o.qty && in_array(o.trdSide, [1])); //非满仓状态且无反方向订单 或者 选中的同方向订单
			b[0] = n && z; //抢多
			b[1] = n && z; //开多
			if (Q['secType'] == 10) { //假定只有期货能做空
				let z = ((c[0] < Q['props']['maxq']) && empty(c[1]) && empty(c[2])) || (o.qty && in_array(o.trdSide, [3]));
				b[2] = m && z; //抢空
				b[3] = m && z; //开空
			}
			b[4] = o.qty ? true : false; //上移
			b[5] = o.qty ? true : false; //下移
			b[6] = o.qty && in_array(o.trdSide, [2, 4]) ? true : false; //强出
			b[7] = o.qty ? true : (G.ctrlKey && c[0] ? true : false); //撤单
			b[8] = o.qty && (o.orderStatus != 22) ? true : (G.ctrlKey && t[5] ? true : false); //失效
			b[9] = o.qty && (o.orderStatus == 22) ? true : (G.ctrlKey && t[22] ? true : false); //生效
			b[10] = o.qty && in_array(o.trdSide, [2, 4]) && ((o.orderStatus == 22) || (o.price != calcRemark(o))) ? true : cost; //平出
		} else {
			b[0] = n;
			b[1] = n;
			if (Q['secType'] == 10) {
				b[2] = m;
				b[3] = m;
			}
		}
	}
	for (let i = 0; i <= 10; i++) {
		if (b[i]) {
			$("#btn" + i).removeAttr("disabled");
			if (Z.trdEnv) { //实盘按钮显示红色
				$("#btn" + i).addClass("red");
			}
		} else {
			$("#btn" + i).attr("disabled", "disabled");
			$("#btn" + i).removeClass("red");
		}
	}
}
/**
 * 得到所有的订单划线
 * @returns {Array|getAnnotations.list}
 */
function getAnnotations() {
	if (empty(G.isWindow)) { //非可视窗口
		return true;
	}
	if (empty(window.chart)) {
		return true;
	}
	let list = [];
	let count = G.ctrl.getAnnotationsCount();
	for (let index = count - 1; index >= 0; index--) {
		let annotation = G.ctrl.getAnnotationAt(index);
		if (empty(annotation)) {
			continue;
		}
		if (annotation.getType() != 'horizontal-line') {
			continue;
		}
		if (annotation.allowEdit() == false) { //成本线也拿下
			//continue;
		}
		let o = G.orders[annotation.zIndex()];
		if (empty(o)) {
			continue;
		}
		list.push([index, o.orderIDEx, annotation.zIndex(), annotation.valueAnchor(), annotation.allowEdit()]);
	}
	list.sort(function(a, b) {
		return a[3] - b[3];
	});
	return list;
}
/**
 * 选中某一条订单划线
 * @param {type} id
 * @returns {Boolean}
 */
function selectAnnotation(id) {
	if (empty(G.isWindow)) { //非可视窗口
		return true;
	}
	if (empty(window.chart)) {
		return true;
	}
	id = intval(id);
	if (empty(G.annotations[id])) {
		return false;
	}
	G.ctrl.select(G.annotations[id]);
}
/**
 * 切换到下一根划线,用于键盘w/s键
 * @param {type} direction
 * @returns {undefined}
 */
function selectNextAnnotation(direction) {
	if (empty(G.isWindow)) { //非可视窗口
		return true;
	}
	if (empty(window.chart)) {
		return true;
	}
	let zero = true; //是否第一根
	let next = true; //是否继续下一根
	let selected = G.ctrl.getSelectedAnnotation();
	let list = getAnnotations();
	for (let step = 0; step < list.length; step++) {
		let i = (direction > 0) ? step : (list.length - 1 - step);
		let d = list[i];
		let annotation = G.ctrl.getAnnotationAt(d[0]);
		if (empty(annotation)) {
			continue;
		}
		if (annotation.getType() != 'horizontal-line') {
			continue;
		}
		if (annotation.allowEdit() == false) {
			continue;
		}
		let o = G.orders[annotation.zIndex()];
		if (empty(o)) {
			continue;
		}
		if (zero === true) {
			zero = false;
			selectAnnotation(o.id);
		}
		if (empty(selected)) {
			break;
		}
		if (next === false) {
			selectAnnotation(o.id);
			break;
		}
		if (selected === annotation) {
			next = false;
		}
	}
}
/**
 * 查找选中的订单划线
 * @param {type} id
 * @returns 
 */
function getSelectedAnnotation(id) {
	if (empty(G.isWindow)) { //非可视窗口
		return {};
	}
	if (empty(window.chart)) {
		return {};
	}
	let cnt = 0; //订单数
	if (empty(G.annotations[id]) && empty(G.ctrl.getSelectedAnnotation()) && (cnt = count(G.orders))) {
		let i = 0;
		let f = true; //待完成订单是否全部为平空/平多(除非已满仓,否则开多/开空不能默认选中)
		for (i in G.orders) {
			i = intval(i);
			if ((cnt < Q['props']['maxq']) && in_array(G.orders[i]['trdSide'], [1, 3])) {
				f = false;
				break;
			}
		}
		if (f == true) {
			id = (is_int(G.id) && G.annotations[G.id]) ? G.id : i;
			is_int(id) && selectAnnotation(id);
		}
	}
	let annotation = is_int(id) ? G.annotations[id] : G.ctrl.getSelectedAnnotation(); //传参或选中的线
	if (empty(annotation)) {
		return {};
	}
	if (empty(G.orders[annotation.zIndex()])) {
		return {};
	}
	G.id = intval(annotation.zIndex());
	return annotation;
}
/**
 * 合并成本价线: 平均成本价划线
 * @param {type} remark
 * @returns {Boolean}
 */
function redoRemark(remark) {
	if (empty(G.isWindow)) { //非可视窗口
		return true;
	}
	if (empty(window.chart)) {
		return true;
	}
	let count = G.ctrl.getAnnotationsCount();
	for (let index = count - 1; index >= 0; index--) {
		let annotation = G.ctrl.getAnnotationAt(index);
		if (empty(annotation)) {
			continue;
		}
		if (annotation.getType() != 'horizontal-line') { //水平线
			continue;
		}
		if (annotation.allowEdit() == true) { //能够拖动的是真实订单
			continue;
		}
		let zIndex = annotation.zIndex();
		if (empty(G.orders[zIndex])) {
			continue;
		}
		if (G.orders[zIndex].remark == remark) {
			continue;
		}
		annotation.valueAnchor(remark);
		G.orders[zIndex].remark = remark;
	}
}
/**
 * 逐档挂单:查出所有同类型的单,隔几档下单
 * @param {type} price
 * @param {type} trdSide
 * @returns {Number}
 */
function calcPrice(price, trdSide) {
	if (empty(G.isWindow)) { //非可视窗口
		return price;
	}
	if (empty(window.chart)) {
		return price;
	}
	let o = {}; //某个订单
	let v = false;
	let h = Number.MIN_SAFE_INTEGER; //这些订单最高价
	let l = Number.MAX_SAFE_INTEGER; //最低价
	let count = G.ctrl.getAnnotationsCount();
	for (let index = count - 1; index >= 0; index--) {
		let annotation = G.ctrl.getAnnotationAt(index);
		if (empty(annotation)) {
			continue;
		}
		if (annotation.getType() != 'horizontal-line') {
			continue;
		}
		if (empty(G.orders[annotation.zIndex()])) { //可能是街货图上的
			continue;
		}
		o = G.orders[annotation.zIndex()];
		if (o.trdSide != trdSide) {
			continue;
		}
		v = true;
		h = max(o.price, price, h);
		l = min(o.price, price, l);
	}
	if (empty(v)) {
		return price;
	}
	if (empty(o)) {
		return price;
	}
	if (in_array(trdSide, [1, 4])) { //开多,平空
		price = gear_down(l, array_first(Q['props']["fill"]), o.code);
	}
	if (in_array(trdSide, [2, 3])) { //平多,开空
		price = gear_up(h, array_first(Q['props']["fill"]), o.code);
	}
	return price;
}
/**
 * 
 * @param {type} dir -1下移 0平出 1上移 5强出
 * @param {type} id
 * @returns {saveAll.price|Number|Boolean}
 */
function saveAll(dir, id) {
	if (empty(G.isWindow)) { //非可视窗口
		return true;
	}
	if (empty(window.chart)) {
		return false;
	}
	if (G.ctrlKey && in_array(dir, [0, 5]) && empty(id)) { //平出/强出所有
		for (let id in G.orders) {
			let o = G.orders[id];
			if (in_array(o.trdSide, [2, 4])) { //平多,平空
				saveAll(dir, intval(id));
			}
		}
		return true;
	}
	let annotation = getSelectedAnnotation(id); //传参或选中的线
	if (empty(annotation)) {
		return false;
	}
	id = annotation.zIndex();
	let value = annotation.valueAnchor();
	let o = G.orders[id];
	if (empty(o)) { //数据不一致
		return false;
	}
	if (empty(Z)) {
		return false;
	}
	let _o = Z.stocks[o.code];
	if (empty(_o)) {
		return false;
	}
	let price = 0;
	if (in_array(o.trdSide, [1, 4])) { //格式化到标准价位
		price = gear_down(value, 0, o.code);
	}
	if (in_array(o.trdSide, [2, 3])) { //格式化到标准价位
		price = gear_up(value, 0, o.code);
	}
	if (price != value) {
		annotation.valueAnchor(price);
	}
	let step = G.ctrlKey ? array_last(_o["props"]["gear"]) : array_first(_o["props"]["gear"]);
	if (isset(dir)) {
		if (in_array(dir, [1, -1])) { //反转后方向相反
			dir = kvs.inverted ? -1 * dir : dir;
		}
		if (dir == 0) { //平出
			price = calcRemark(o);
		}
		if (dir == 1) { //上移
			price = gear_up(o.price, step, o.code);
			if (in_array(o.trdSide, [1, 4])) { //开多,平空
				price = min(price, Q['curPrice']);
			}
			if ((G.ctrlKey == false) && in_array(o.trdSide, [4])) { //平空,不高于成本价
				price = min(price, o.remark);
			}
		}
		if (dir == -1) { //下移
			price = gear_down(o.price, step, o.code);
			if (in_array(o.trdSide, [2, 3])) { //平多,开空
				price = max(price, Q['curPrice']);
			}
			if ((G.ctrlKey == false) && in_array(o.trdSide, [2])) { //平多,不低于成本价
				price = max(price, o.remark);
			}
		}
		if (dir == 5) { //抢出.一般在逃生的时候用
			if (in_array(o.trdSide, [2])) { //平多
				price = gear_down(Q['curPrice'], step, o.code);
			}
			if (in_array(o.trdSide, [4])) { //平空
				price = gear_up(Q['curPrice'], step, o.code);
			}
		}
	}
	if (o.price == price) {
		let f = in_array(dir, [0, 5]) && in_array(o.orderStatus, [22]); //对于失效状态的,平出强出要强制生效
		if (empty(f)) {
			return true;
		}
	}
	if (o.price != price) {
		Z.Trd_ModifyOrder(o["orderIDEx"], 1, o['code'], o['trdSide'], o["qty"], price, o['remark']);
	}
	if (in_array(dir, [0, 5]) && in_array(o.orderStatus, [22])) { //平出强出强制生效
		Z.Trd_ModifyOrder(o["orderIDEx"], 4, o['code'], o['trdSide'], o['qty'], price, o['remark']);
	}
}
/**
 * 画主图
 * @param {type} klines
 * @returns {undefined}
 */
function kchart(klines) {
	if (empty(G.isWindow)) { //非可视窗口
		return true;
	}
	if (empty(window.chart) == false) { //已经初始化过
		return true;
	}
	if (empty(window.anychart)) {
		return true;
	}

	anychart.format.outputTimezone(-480);

	let formats = anychart.format.locales['default'].dateTimeLocale.formats;
	formats.full_year_minute = "yyyy-MM-dd HH:mm";
	formats.full_year_hour = "yyyy-MM-dd HH:mm";
	formats.full_year_day = "yyyy-MM-dd";

	window.chart = anychart.stock(true);

	let stage = anychart.graphics.create('k-container');
	$("#k-container").find("div[id]").hide();
	window.table = anychart.data.table(0);
	table.addData(klines);
	let candlestickMapping = window.table.mapAs();
	candlestickMapping.addField('x', 0);
	candlestickMapping.addField('open', 1);
	candlestickMapping.addField('high', 2);
	candlestickMapping.addField('low', 3);
	candlestickMapping.addField('close', 4);
	candlestickMapping.addField('change', 8);
	candlestickMapping.addField('changeRate', 9);
	window.series = chart.plot(0).candlestick(candlestickMapping);
	series.risingStroke("red");
	series.risingFill("red");
	series.fallingStroke("green");
	series.fallingFill("green");
	let tooltip = series.tooltip();
	tooltip.format("开盘:{%open}\n最高:{%high}\n最低:{%low}\n收盘:{%close}\n涨跌额:{%change}\n涨跌幅:{%changeRate}");
	let smaMapping = window.table.mapAs();
	smaMapping.addField('x', 0);
	smaMapping.addField('value', 4);
	let sma10 = chart.plot(0).sma(smaMapping, 10, 'line').series();
	sma10.stroke('#0CAEE6');
	sma10.tooltip(false);
	let sma20 = chart.plot(0).sma(smaMapping, 20, 'line').series();
	sma20.stroke('#E970DC');
	sma20.tooltip(false);
	let sma60 = chart.plot(0).sma(smaMapping, 60, 'line').series();
	sma60.stroke('#22C57E');
	sma60.tooltip(false);
	let customContextMenu = chart.contextMenu();
	customContextMenu.itemsProvider(function() {
		return [{
			text: 'Open AnyChart API',
			href: 'https://api.anychart.com'
		}];
	});
	customContextMenu.enabled(false);
	chart.listen("annotationDrawingFinish", function(e) {
		if (e.annotation.zIndex() == -1) { //-1为手搓线
			return saveLine();
		}
		saveAll(); //改单
	});
	chart.listen("annotationChangeFinish", function(e) {
		if (e.annotation.zIndex() == -1) { //-1为手搓线
			return saveLine();
		}
		saveAll();
		buttons(!G.lock);
	});
	chart.listen("annotationSelect", function() {
		window.setTimeout(function() {
			buttons(!G.lock);
		}, 0);
	});
	chart.listen("annotationUnselect", function() {
		window.setTimeout(function() {
			buttons(!G.lock);
		}, 0);
	});
	chart.listen("click", function() {
		window.top.focus();
	});
	let calcMin = floor((Q['curPrice'] - prefs.crange / 2) / prefs.tickInterval) * prefs.tickInterval;
	let calcMax = calcMin + prefs.crange;
	chart.plot(0).yScale().minimum(calcMin);
	chart.plot(0).yScale().maximum(calcMax);
	chart.plot(0).yScale().ticks().interval(prefs.tickInterval);
	prefs.cYmin = min(prefs.cYmin, calcMin);
	prefs.cYmax = max(prefs.cYmax, calcMax);
	chart.listenOnce('chartDraw', function() {
		window.scroller = anychart.standalones.scroller(); //单独的滚动条[等比缩放的原理,忘记当时怎么弄的现在也整不明白了]
		scroller.orientation('right');
		scroller.allowRangeChange(false);
		scroller.autoHide(false);
		scroller.zIndex(1000);
		scroller.enabled(prefs.right); //是否显示滚动条
		scroller.startRatio((calcMin - prefs.cYmin) / (prefs.cYmax - prefs.cYmin));
		scroller.endRatio((calcMax - prefs.cYmin) / (prefs.cYmax - prefs.cYmin));
		let plotBounds = chart.getPixelBounds();
		let yAxisBounds = chart.plot(0).yAxis().getPixelBounds();
		scroller.parentBounds(0, yAxisBounds.top + 5, plotBounds.width, yAxisBounds.height - 10);
		scroller.container(stage).draw();
		scroller.listen('scrollerChange', function(e) {
			let calcMin = prefs.cYmin + (prefs.cYmax - prefs.cYmin) * e.startRatio;
			let calcMax = prefs.cYmin + (prefs.cYmax - prefs.cYmin) * e.endRatio;
			chart.plot(0).yScale().minimum(calcMin);
			chart.plot(0).yScale().maximum(calcMax);
		});
	});
	G.ctrl = chart.plot(0).annotations(); //画线控制台
	let key = implode(":", ["annotations", Q['main_code'], O.date]);
	let annotations = array_values(kvs[key] ?? []);
	for (let i in annotations) { //手搓的压力线
		G.ctrl.add({
			type: "horizontal-line",
			zIndex: -1, //会跟订单线摆在同一个图上,大于0的是订单线
			allowEdit: in_array(O.pmode, [5]) ? true : false, //只有复盘模式能改动
			color: "rgba(255,157,0)",
			stroke: '2 rgba(255,157,0)',
			valueAnchor: floatval(annotations[i])
		});
	}
	if (Q["lower_limit"]) { //跌停板
		G.ctrl.add({
			type: "horizontal-line",
			zIndex: -1, //会跟订单线摆在同一个图上,大于0的是订单线
			allowEdit: false, //不能改动
			color: "rgba(0,0,255)",
			stroke: '1 rgba(0,0,255)',
			valueAnchor: floatval(Q["lower_limit"])
		});
	}
	if (Q["upper_limit"]) { //涨停板
		G.ctrl.add({
			type: "horizontal-line",
			zIndex: -1, //会跟订单线摆在同一个图上,大于0的是订单线
			allowEdit: false, //不能改动
			color: "rgba(0,0,255)",
			stroke: '1 rgba(0,0,255)',
			valueAnchor: floatval(Q["upper_limit"])
		});
	}
	if (in_array(O.pmode, [5]) && !in_array(O.klType, [2])) {
		let xAnchor;
		let annotation;
		xAnchor = O.date + 9 * 60 * 60; //早盘分割线
		annotation = G.ctrl.add({
			type: "vertical-line",
			color: "blue",
			stroke: '1 blue',
			xAnchor: xAnchor * 1000
		});
		annotation.allowEdit(false);
		xAnchor = O.date + 13 * 60 * 60; //午盘分割线
		annotation = G.ctrl.add({
			type: "vertical-line",
			color: "blue",
			stroke: '1 blue',
			xAnchor: xAnchor * 1000
		});
		annotation.allowEdit(false);
		xAnchor = O.date + 17 * 60 * 60; //晚盘分割线
		annotation = G.ctrl.add({
			type: "vertical-line",
			color: "blue",
			stroke: '1 blue',
			xAnchor: xAnchor * 1000
		});
		annotation.allowEdit(false);
	}
	let padding = chart.padding();
	padding.top(0);
	padding.bottom(0);
	padding.left(prefs.left);
	padding.right(prefs.right);
	chart.title(false);
	chart.scroller().enabled(false);
	chart.splitters().enabled(false); //plot之间的分割线
	chart.plot(0).xAxis().enabled(false);
	chart.plot(0).yAxis().enabled(true);
	chart.plot(0).yGrid(true);
	chart.plot(0).legend(false);
	chart.credits(false);
	chart.crosshair().displayMode("float"); //sticky
	chart.plot(0).height($('#k-container').height() - prefs.vh);
	chart.plot(1).height(prefs.vh);
	chart.plot(1).xAxis().enabled(false); //是否显示X轴
	chart.plot(1).yGrid(true); //是否显示Y轴网格线
	chart.plot(1).legend(false);
	window.eventMarkers = chart.plot(0).eventMarkers(); //用于成交打点
	eventMarkers.group(0, []);
	eventMarkers.group(0).format("B");
	eventMarkers.group(0).normal().fontColor("red");
	eventMarkers.group(0).normal().fill("white");
	eventMarkers.group(0).position('series');
	eventMarkers.group(0).fieldName('high');
	eventMarkers.group(0).direction("up");
	eventMarkers.group(1, []);
	eventMarkers.group(1).format("B");
	eventMarkers.group(1).normal().fontColor("blue");
	eventMarkers.group(1).normal().fill("white");
	eventMarkers.group(1).position('series');
	eventMarkers.group(1).fieldName('low');
	eventMarkers.group(1).direction("down");
	eventMarkers.group(2, []);
	eventMarkers.group(2).format("S");
	eventMarkers.group(2).normal().fontColor("red");
	eventMarkers.group(2).normal().fill("white");
	eventMarkers.group(2).position('series');
	eventMarkers.group(2).fieldName('high');
	eventMarkers.group(2).direction("up");
	eventMarkers.group(3, []);
	eventMarkers.group(3).format("S");
	eventMarkers.group(3).normal().fontColor("blue");
	eventMarkers.group(3).normal().fill("white");
	eventMarkers.group(3).position('series');
	eventMarkers.group(3).fieldName('low');
	eventMarkers.group(3).direction("down");
	chart.container(stage).draw();
	chart.selectRange('points', prefs.cpoints, false);
	if (O.day && window.klines[60] && window.klines[60 + prefs.cpoints]) { //复盘模式会来这里
		chart.selectRange(klines[60][0], klines[60 + prefs.cpoints][0], false);
	}
	chart.listen("selectedrangechangefinish", function(e) { //拖动图型后还原到最新K线处
		if (in_array(O.pmode, [5])) { //复盘模式不显示前60条
			let selectedRange = chart.getSelectedRange();
			if (window.klines[60] && window.klines[60 + prefs.cpoints] && (klines[60][0] > selectedRange.firstSelected)) {
				chart.selectRange(klines[60][0], klines[60 + prefs.cpoints][0], false);
			}
			return true;
		}
		chart.selectRange('points', prefs.cpoints, false);
	});
	let volumeMapping = window.table.mapAs({
		x: 0,
		value: 5,
		volume: 5,
		turnover: 6,
		fill: 10
	});
	let volumeSeries = chart.plot(1).column(volumeMapping);
	//volumeSeries.risingStroke('red');
	//volumeSeries.fallingStroke('green');
	//volumeSeries.risingFill('red');
	//volumeSeries.fallingFill('green');
	//volumeSeries.pointWidth('70%');
	volumeSeries.name("成交量");
	let volumeTooltip = volumeSeries.tooltip();
	//volumeTooltip.format("成交量:{%volume}\n成交额:{%turnover}");
	volumeTooltip.format(function() {
		let s = "";
		s += "成交量:" + bytes(this.getData("volume")) + "\n";
		s += "成交额:" + HKD(this.getData("turnover")) + "";
		return s;
	});
	let lots = array_last(Q['props'][O.klType]); //个性化配置
	chart.plot(1).yScale().minimum(lots * 1000 * 0);
	chart.plot(1).yScale().maximum(lots * 1000 * 1);
	chart.plot(1).yScale().ticks().interval(lots * 1000 / 2);
	document.addEventListener("wheel", function(e) { //鼠标滚轮控制主图的上下滚动
		e.preventDefault();
		if (window.chart && window.scroller) {
			let a = window.scroller.startRatio();
			let b = window.scroller.endRatio();
			let change = false;
			let dir = kvs.inverted ? -1 : +1; //是否翻转
			let step = 0;
			let aa = 0;
			let bb = 0;
			let direct = 0;
			if (e.deltaY * dir < 0) { //向上
				step = min(0.025, 1 - b);
				aa = a + step;
				bb = b + step;
				direct = 1;
				change = (bb <= 1) ? true : false;
			}
			if (e.deltaY * dir > 0) { //向下
				step = min(0.025, a - 0);
				aa = a - step;
				bb = b - step;
				direct = -1;
				change = (aa >= 0) ? true : false;
			}
			if (change == false) {
				return true;
			}
			if (direct == 1) {
				window.scroller.endRatio(bb);
				window.scroller.startRatio(aa);
			}
			if (direct == -1) {
				window.scroller.startRatio(aa);
				window.scroller.endRatio(bb);
			}
			let calcMin = prefs.cYmin + (prefs.cYmax - prefs.cYmin) * aa;
			let calcMax = prefs.cYmin + (prefs.cYmax - prefs.cYmin) * bb;
			chart.plot(0).yScale().minimum(calcMin);
			chart.plot(0).yScale().maximum(calcMax);
		}
	}, {
		passive: false,
		capture: false
	});
}
/**
 * 控制遮罩层的展示
 * @param {type} f true展示;false隐藏;否则返回状态
 * @returns {Boolean}
 */
function preloader(f) {
	if (empty(G.isWindow)) { //非可视窗口
		return true;
	}
	if (empty(window.anychart)) { //非绘图页面
		return true;
	}
	if (empty(G.preloader)) {
		G.preloader = anychart.ui.preloader();
		G.preloader.render();
	}
	if (typeof(f) !== 'boolean') {
		return G.preloader.visible();
	}
	if (G.preloader.visible() === f) {
		return true;
	}
	G.preloader.visible(f);
	$("#locker").prop('checked', f);
}
/**
 * 翻转主图
 * @param {type} f
 * @returns {undefined}
 */
function inverted(f, trigger) {
	if (empty(G.isWindow)) { //非可视窗口
		return true;
	}
	if (empty(window.chart)) {
		return true;
	}
	kvs.inverted = boolval(f);
	if (window.chart && window.scroller && window.series) {
		if (window.scroller.inverted() == kvs.inverted) {
			return true;
		}
		window.scroller.inverted(kvs.inverted);
		window.chart.plot(0).yScale().inverted(kvs.inverted);
		if (window.whart) {
			window.whart.xScale().inverted(kvs.inverted);
		}
		if (kvs.inverted) {
			window.series.risingStroke("green");
			window.series.risingFill("green");
			window.series.fallingStroke("red");
			window.series.fallingFill("red");
			$('#tips').css({
				"border-left": "1px solid red",
				"border-bottom": "1px solid red"
			});
			$('#gap').css({
				"border-right": "1px solid red",
				"border-bottom": "1px solid red"
			});
			$('#buttons').css({
				"border-left": "1px solid red",
				"border-right": "1px solid red",
				"border-bottom": "1px solid red"
			});
			//window.chart.background().fill("#EBF4FD");
			if (window.whart) {
				//window.whart.background().fill("#EBF4FD");
			}
			//$("#trader").css("background-color", "#EBF4FD");
			$("#btn0").appendTo("#opt2");
			$("#btn1").appendTo("#opt2");
			$("#btn0").html("抢空");
			$("#btn1").html("开空");
			$("#btn2").appendTo("#opt1");
			$("#btn3").appendTo("#opt1");
			$("#btn2").html("抢多");
			$("#btn3").html("开多");
		} else {
			window.series.risingStroke("red");
			window.series.risingFill("red");
			window.series.fallingStroke("green");
			window.series.fallingFill("green");
			$('#tips').css({
				"border-left": "1px solid green",
				"border-bottom": "1px solid green"
			});
			$('#gap').css({
				"border-right": "1px solid green",
				"border-bottom": "1px solid green"
			});
			$('#buttons').css({
				"border-left": "1px solid green",
				"border-right": "1px solid green",
				"border-bottom": "1px solid green"
			});
			//window.chart.background().fill("#FFFFFF");
			if (window.whart) {
				//window.whart.background().fill("#FFFFFF");
			}
			//$("#trader").css("background-color", "#FFFFFF");
			$("#btn0").appendTo("#opt1");
			$("#btn1").appendTo("#opt1");
			$("#btn0").html("抢多");
			$("#btn1").html("开多");
			$("#btn2").appendTo("#opt2");
			$("#btn3").appendTo("#opt2");
			$("#btn2").html("抢空");
			$("#btn3").html("开空");
		}
		let rows = $('#trd_order').find('tr:not(:first)');
		$('#trd_order').find('tr:first').after(rows.get().reverse());
		$(":input[name='inverted']").prop('checked', kvs.inverted);
		trigger && (top != self) && window.top.inverted(kvs.inverted); //触发上级窗口
		trigger && db.table("z-kvs").put({
			type: 1,
			key: 'inverted',
			value: kvs.inverted,
			expire: 0
		});
	} else {
		window.setTimeout(inverted, 200, kvs.inverted);
	}
}
/**
 * 是否展示成交打点
 * @param {type} ids 更新数组
 * @returns
 */
function showfills(f, trigger, ids) {
	if (empty(G.isWindow)) { //非可视窗口
		return true;
	}
	if (empty(window.chart)) {
		return true;
	}
	kvs.showfills = boolval(f);
	is_array(ids) && ids.forEach(function(id, k, ids) {
		let group = -1;
		let a = G.fills[id];
		let desc = ["BN", "BX", "SN", "SX"];
		let time = ceil(a.updateTimestamp / 60) * 60 * 1000;
		if (in_array(a.trdSide, [1, 3])) { //开多,开空
			if (in_array(a.trdSide, [1]) && in_array(a.type, [0, 1, 3])) {
				group = 0;
			}
			if (in_array(a.trdSide, [3]) || in_array(a.type, [2, 4])) {
				group = 1;
			}
		}
		if (in_array(a.trdSide, [2, 4])) { //平多,平空
			if (in_array(a.trdSide, [2]) && in_array(a.type, [0, 1, 3])) {
				group = 2;
			}
			if (in_array(a.trdSide, [4]) || in_array(a.type, [2, 4])) {
				group = 3;
			}
		}
		let g = G.groups[group][time] || {};
		G.groups[group][time] = {
			'date': time,
			'description': ((empty(g) ? "" : (g['description'] + "\n")) + desc[group] + a.price + "(" + a.qty + ")")
		};
	});
	for (let group = 0; group <= 3; group++) {
		window.eventMarkers.group(group, kvs.showfills ? array_values(G.groups[group] ?? []) : []);
	}
	trigger && db.table("z-kvs").put({
		type: 1,
		key: 'showfills',
		value: kvs.showfills,
		expire: 0
	});
}
/**
 * 保存所有划线
 * @returns {Boolean}
 */
function saveLine() {
	if (empty(G.isWindow)) { //非可视窗口
		return true;
	}
	if (empty(window.chart)) {
		return true;
	}
	let list = [];
	let count = G.ctrl.getAnnotationsCount();
	for (let index = count - 1; index >= 0; index--) {
		let annotation = G.ctrl.getAnnotationAt(index);
		if (empty(annotation)) {
			continue;
		}
		if (annotation.zIndex() != -1) {
			continue;
		}
		if (annotation.getType() != 'horizontal-line') {
			continue;
		}
		list.push(annotation.valueAnchor());
	}
	let key = implode(":", ["annotations", Q['main_code'], O.date]);
	db.table("z-kvs").put({
		type: 1,
		key: key,
		value: list,
		expire: time() + 30 * 24 * 60 * 60
	});
}
/**
 * 
 * @param {type} forAll
 * @returns {Boolean}
 */
function removeLine(forAll) {
	if (empty(G.isWindow)) { //非可视窗口
		return true;
	}
	if (empty(window.chart)) {
		return true;
	}
	let count = G.ctrl.getAnnotationsCount();
	let selected = G.ctrl.getSelectedAnnotation();
	for (let index = count - 1; index >= 0; index--) {
		let annotation = G.ctrl.getAnnotationAt(index);
		if (empty(annotation)) {
			continue;
		}
		if (annotation.zIndex() !== -1) {
			continue;
		}
		if (annotation.getType() !== 'horizontal-line') {
			continue;
		}
		if (forAll || (selected === annotation)) {
			G.ctrl.removeAnnotation(annotation);
		}
	}
	saveLine();
}
/**
 * 创建一根水平线
 * @returns {undefined}
 */
function createLine() {
	if (empty(G.isWindow)) { //非可视窗口
		return true;
	}
	if (empty(window.chart)) {
		return true;
	}
	G.ctrl.startDrawing({
		type: "horizontal-line",
		color: "rgba(255,157,0)",
		stroke: '2 rgba(255,157,0)',
		zIndex: -1, //会跟订单线摆在同一个图上,大于0的是订单线
		allowEdit: in_array(O.pmode, [5]) ? true : false //只有复盘模式能调此方法
	});
}
/**
 * 是否展示街货图
 * @param {type} f
 * @returns {undefined}
 */
function showVol(f) {
	if (empty(G.isWindow)) { //非可视窗口
		return true;
	}
	f ? $('#w-container').show() : $('#w-container').hide();
}
/**
 * 自定义指标.已弃用
 * @param {type} f
 * @returns {undefined}
 */
function pivoted(f) {
	if (empty(G.isWindow)) { //非可视窗口
		return true;
	}
	if (empty(window.chart)) {
		return true;
	}
	kvs.pivoted = boolval(f);
	chart.plot(1).removeAllSeries();
	if (kvs.pivoted) {
		let tInt = 0; //倒数第二十根的时间
		let lInt = 0; //计算的最后一根时间
		let pArr = [];
		let vArr = [];
		if (empty(window.computer)) {
			let pivotMapping = window.table.mapAs();
			pivotMapping.addField('x', 0);
			pivotMapping.addField('value', 4);
			window.computer = window.table.createComputer(pivotMapping);
			computer.addOutputField('pivot', 'pivot');
			computer.addOutputField('fill', 'fill');
		}
		computer.setStartFunction(function() {
			pArr = [];
			computer.setContext({
				enabled: true
			});
		});
		computer.setCalculationFunction(function(row, context) {
			//if(context.enabled == false){
			//	return true;
			//}
			let v = row.get('value');
			let t = row.get('x') / 1000;
			if (t < tInt) { //不需要这么多
				return true;
			}
			pArr.push([t, v]);
			if (t <= lInt) { //已经有值的不再更新
				return true;
			}
			let pivot = 0;
			let fill = 'red';
			if (pArr.length >= 20) {
				pArr = pArr.slice(-20);
				tInt = pArr[0][0];
				let avg = 0;
				for (let i in pArr) {
					avg += pArr[i][1];
				}
				vArr[t] = avg / pArr.length;
				if (vArr[pArr[18][0]]) { //前面那一根的移动平均值
					lInt = pArr[18][0];
					pivot = vArr[t] - vArr[pArr[18][0]];
					fill = vArr[t] >= vArr[pArr[18][0]] ? 'red' : 'green';
				}
			}
			row.set('fill', fill);
			row.set('pivot', pivot);
		});
		let pivotMapping = window.table.mapAs({
			'value': 'pivot',
			'fill': 'fill'
		});
		let pivotLine = chart.plot(1).column(pivotMapping);
		pivotLine.name("均差");
		//pivotLine.stroke('red');
		pivotLine.tooltip(true);
		chart.plot(1).yScale().minimum(-10);
		chart.plot(1).yScale().maximum(10);
		chart.plot(1).yScale().ticks().interval(5);
	} else {
		let volumeMapping = window.table.mapAs({
			x: 0,
			value: 5,
			volume: 5,
			turnover: 6,
			fill: 10
		});
		let volumeSeries = chart.plot(1).column(volumeMapping);
		//volumeSeries.risingStroke('red');
		//volumeSeries.fallingStroke('green');
		//volumeSeries.risingFill('red');
		//volumeSeries.fallingFill('green');
		//volumeSeries.pointWidth('70%');
		volumeSeries.name("成交量");
		let volumeTooltip = volumeSeries.tooltip();
		//volumeTooltip.format("成交量:{%volume}\n成交额:{%turnover}");
		volumeTooltip.format(function() {
			let s = "";
			s += "成交量:" + bytes(this.getData("volume")) + "\n";
			s += "成交额:" + HKD(this.getData("turnover")) + "";
			return s;
		});
		let lots = array_last(Q['props'][O.klType]); //个性化配置
		chart.plot(1).yScale().minimum(lots * 1000 * 0);
		chart.plot(1).yScale().maximum(lots * 1000 * 1);
		chart.plot(1).yScale().ticks().interval(lots * 1000 / 2);
		if (window.computer) {
			computer.setStartFunction(null);
			computer.setCalculationFunction(null);
		}
	}
	$(":input[name='pivoted']").prop('checked', kvs.pivoted);
	db.table("z-kvs").put({
		type: 1,
		key: 'pivoted',
		value: kvs.pivoted,
		expire: 0
	});
}