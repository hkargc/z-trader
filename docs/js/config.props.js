"use strict";
/**
Object.assign(config.props['$instrument_id'], { //$instrument_name
	marg: 1, //整数.margin 1-100保证金比例
	fees: ['3', '0'] //字串数组.[开仓手续费, 平今手续费] [10, '1/10000'] 表示 [开仓10元/手,平今 万分之一]
});
**/
Object.assign(config.props['KQ.m@CFFEX.IC'], { //中证主连
	marg: 15,
	fees: ['0.23/10000', '2.3/10000']
});
Object.assign(config.props['KQ.m@CFFEX.IF'], { //沪深主连
	marg: 15,
	fees: ['0.23/10000', '2.3/10000']
});
Object.assign(config.props['KQ.m@CFFEX.IH'], { //上证主连
	marg: 15,
	fees: ['0.23/10000', '2.3/10000']
});
Object.assign(config.props['KQ.m@CFFEX.IM'], { //IM主连
	marg: 15,
	fees: ['0.23/10000', '2.3/10000']
});
Object.assign(config.props['KQ.m@CFFEX.T'], { //债十主连
	marg: 3,
	fees: ['3', '0']
});
Object.assign(config.props['KQ.m@CFFEX.TF'], { //债五主连
	marg: 2,
	fees: ['3', '0']
});
Object.assign(config.props['KQ.m@CFFEX.TL'], { //债三十主连
	marg: 5,
	fees: ['3', '0']
});
Object.assign(config.props['KQ.m@CFFEX.TS'], { //债二主连
	marg: 1,
	fees: ['3', '0']
});
Object.assign(config.props['KQ.m@CZCE.AP'], { //苹果主连
	marg: 14,
	fees: ['5', '10']
});
Object.assign(config.props['KQ.m@CZCE.CF'], { //棉花主连
	marg: 12,
	fees: ['4.3', '0']
});
Object.assign(config.props['KQ.m@CZCE.CJ'], { //红枣主连
	marg: 13,
	fees: ['3', '3']
});
Object.assign(config.props['KQ.m@CZCE.CY'], { //棉纱主连
	marg: 15,
	fees: ['1', '0']
});
Object.assign(config.props['KQ.m@CZCE.FG'], { //玻璃主连
	marg: 15,
	fees: ['2', '2']
});
Object.assign(config.props['KQ.m@CZCE.JR'], { //粳稻主连
	marg: 25,
	fees: ['3', '3']
});
Object.assign(config.props['KQ.m@CZCE.LR'], { //晚稻主连
	marg: 25,
	fees: ['3', '3']
});
Object.assign(config.props['KQ.m@CZCE.MA'], { //甲醇主连
	marg: 14,
	fees: ['1/10000', '1/10000']
});
Object.assign(config.props['KQ.m@CZCE.OI'], { //菜油主连
	marg: 13,
	fees: ['2', '2']
});
Object.assign(config.props['KQ.m@CZCE.PF'], { //短纤主连
	marg: 13,
	fees: ['2', '0']
});
Object.assign(config.props['KQ.m@CZCE.PK'], { //花生仁主连
	marg: 13,
	fees: ['2', '2']
});
Object.assign(config.props['KQ.m@CZCE.PL'], { //丙烯主连
	marg: 14,
	fees: ['3', '0']
});
Object.assign(config.props['KQ.m@CZCE.PM'], { //普麦主连
	marg: 40,
	fees: ['30', '30']
});
Object.assign(config.props['KQ.m@CZCE.PR'], { //瓶片主连
	marg: 13,
	fees: ['0.5/10000', '0']
});
Object.assign(config.props['KQ.m@CZCE.PX'], { //对二甲苯主连
	marg: 14,
	fees: ['1/10000', '0']
});
Object.assign(config.props['KQ.m@CZCE.RI'], { //早稻主连
	marg: 25,
	fees: ['2.5', '2.5']
});
Object.assign(config.props['KQ.m@CZCE.RM'], { //菜粕主连
	marg: 13,
	fees: ['1.5', '0']
});
Object.assign(config.props['KQ.m@CZCE.RS'], { //菜籽主连
	marg: 25,
	fees: ['2', '0']
});
Object.assign(config.props['KQ.m@CZCE.SA'], { //纯碱主连
	marg: 14,
	fees: ['1/10000', '1/10000']
});
Object.assign(config.props['KQ.m@CZCE.SF'], { //硅铁主连
	marg: 13,
	fees: ['2', '0']
});
Object.assign(config.props['KQ.m@CZCE.SH'], { //烧碱主连
	marg: 14,
	fees: ['1/10000', '0']
});
Object.assign(config.props['KQ.m@CZCE.SM'], { //锰硅主连
	marg: 13,
	fees: ['2', '0']
});
Object.assign(config.props['KQ.m@CZCE.SR'], { //白糖主连
	marg: 12,
	fees: ['2', '0']
});
Object.assign(config.props['KQ.m@CZCE.TA'], { //PTA主连
	marg: 14,
	fees: ['3', '0']
});
Object.assign(config.props['KQ.m@CZCE.UR'], { //尿素主连
	marg: 13,
	fees: ['1/10000', '1/10000']
});
Object.assign(config.props['KQ.m@CZCE.WH'], { //强麦主连
	marg: 40,
	fees: ['30', '30']
});
Object.assign(config.props['KQ.m@CZCE.ZC'], { //郑煤主连
	marg: 55,
	fees: ['150', '150']
});
Object.assign(config.props['KQ.m@DCE.a'], { //豆一主连
	marg: 12,
	fees: ['2', '2']
});
Object.assign(config.props['KQ.m@DCE.b'], { //豆二主连
	marg: 13,
	fees: ['1', '1']
});
Object.assign(config.props['KQ.m@DCE.bb'], { //胶板主连
	marg: 30,
	fees: ['0.5/10000', '0.5/10000']
});
Object.assign(config.props['KQ.m@DCE.bz'], { //纯苯主连
	marg: 14,
	fees: ['3', '3']
});
Object.assign(config.props['KQ.m@DCE.c'], { //玉米主连
	marg: 12,
	fees: ['1.2', '1.2']
});
Object.assign(config.props['KQ.m@DCE.cs'], { //淀粉主连
	marg: 11,
	fees: ['1.5', '1.5']
});
Object.assign(config.props['KQ.m@DCE.eb'], { //苯乙烯主连
	marg: 14,
	fees: ['1', '1']
});
Object.assign(config.props['KQ.m@DCE.eg'], { //甘醇主连
	marg: 14,
	fees: ['3', '3']
});
Object.assign(config.props['KQ.m@DCE.fb'], { //纤板主连
	marg: 23,
	fees: ['0.5/10000', '0.5/10000']
});
Object.assign(config.props['KQ.m@DCE.i'], { //铁矿主连
	marg: 14,
	fees: ['1/10000', '1/10000']
});
Object.assign(config.props['KQ.m@DCE.j'], { //焦炭主连
	marg: 17,
	fees: ['1.4/10000', '1.4/10000']
});
Object.assign(config.props['KQ.m@DCE.jd'], { //鸡蛋主连
	marg: 13,
	fees: ['1.5/10000', '1.5/10000']
});
Object.assign(config.props['KQ.m@DCE.jm'], { //焦煤主连
	marg: 17,
	fees: ['1/10000', '1/10000']
});
Object.assign(config.props['KQ.m@DCE.l'], { //聚乙烯主连
	marg: 13,
	fees: ['1', '1']
});
Object.assign(config.props['KQ.m@DCE.lg'], { //原木主连
	marg: 11,
	fees: ['0.3/10000', '0.3/10000']
});
Object.assign(config.props['KQ.m@DCE.lh'], { //生猪主连
	marg: 16,
	fees: ['2/10000', '2/10000']
});
Object.assign(config.props['KQ.m@DCE.m'], { //豆粕主连
	marg: 13,
	fees: ['1.5', '1.5']
});
Object.assign(config.props['KQ.m@DCE.p'], { //棕榈主连
	marg: 13,
	fees: ['2.5', '2.5']
});
Object.assign(config.props['KQ.m@DCE.pg'], { //LPG主连
	marg: 14,
	fees: ['6', '6']
});
Object.assign(config.props['KQ.m@DCE.pp'], { //PP主连
	marg: 13,
	fees: ['1', '1']
});
Object.assign(config.props['KQ.m@DCE.rr'], { //粳米主连
	marg: 11,
	fees: ['1', '1']
});
Object.assign(config.props['KQ.m@DCE.v'], { //PVC主连
	marg: 13,
	fees: ['1', '1']
});
Object.assign(config.props['KQ.m@DCE.y'], { //豆油主连
	marg: 13,
	fees: ['2.5', '2.5']
});
Object.assign(config.props['KQ.m@GFEX.lc'], { //碳酸锂主连
	marg: 22,
	fees: ['0.8/10000', '0.8/10000']
});
Object.assign(config.props['KQ.m@GFEX.pd'], { //钯主连
	marg: 20,
	fees: ['1/10000', '0']
});
Object.assign(config.props['KQ.m@GFEX.ps'], { //多晶硅主连
	marg: 20,
	fees: ['1/10000', '2.5/10000']
});
Object.assign(config.props['KQ.m@GFEX.pt'], { //铂主连
	marg: 20,
	fees: ['1/10000', '0']
});
Object.assign(config.props['KQ.m@GFEX.si'], { //工业硅主连
	marg: 17,
	fees: ['1/10000', '0']
});
Object.assign(config.props['KQ.m@INE.bc'], { //国际铜主连
	marg: 14,
	fees: ['0.1/10000', '0']
});
Object.assign(config.props['KQ.m@INE.ec'], { //欧线集运主连
	marg: 26,
	fees: ['6/10000', '12/10000']
});
Object.assign(config.props['KQ.m@INE.lu'], { //低硫燃料油主连
	marg: 22,
	fees: ['0.1/10000', '0.1/10000']
});
Object.assign(config.props['KQ.m@INE.nr'], { //20号胶主连
	marg: 14,
	fees: ['0.2/10000', '0']
});
Object.assign(config.props['KQ.m@INE.sc'], { //原油主连
	marg: 22,
	fees: ['20', '0']
});
Object.assign(config.props['KQ.m@SHFE.ad'], { //铝合金主连
	marg: 13,
	fees: ['0.5/10000', '0']
});
Object.assign(config.props['KQ.m@SHFE.ag'], { //沪银主连
	marg: 28,
	fees: ['0.5/10000', '0.5/10000']
});
Object.assign(config.props['KQ.m@SHFE.al'], { //沪铝主连
	marg: 14,
	fees: ['3', '3']
});
Object.assign(config.props['KQ.m@SHFE.ao'], { //氧化铝主连
	marg: 14,
	fees: ['1/10000', '1/10000']
});
Object.assign(config.props['KQ.m@SHFE.au'], { //沪金主连
	marg: 20,
	fees: ['20', '0']
});
Object.assign(config.props['KQ.m@SHFE.br'], { //丁橡胶主连
	marg: 17,
	fees: ['0.2/10000', '0.2/10000']
});
Object.assign(config.props['KQ.m@SHFE.bu'], { //沥青主连
	marg: 18,
	fees: ['0.5/10000', '0']
});
Object.assign(config.props['KQ.m@SHFE.cu'], { //沪铜主连
	marg: 14,
	fees: ['0.5/10000', '1/10000']
});
Object.assign(config.props['KQ.m@SHFE.fu'], { //燃油主连
	marg: 22,
	fees: ['0.5/10000', '0']
});
Object.assign(config.props['KQ.m@SHFE.hc'], { //热卷主连
	marg: 13,
	fees: ['1/10000', '1/10000']
});
Object.assign(config.props['KQ.m@SHFE.ni'], { //沪镍主连
	marg: 15,
	fees: ['3', '3']
});
Object.assign(config.props['KQ.m@SHFE.op'], { //胶版纸主连
	marg: 13,
	fees: ['0.2/10000', '0']
});
Object.assign(config.props['KQ.m@SHFE.pb'], { //沪铅主连
	marg: 14,
	fees: ['0.4/10000', '0']
});
Object.assign(config.props['KQ.m@SHFE.rb'], { //螺纹主连
	marg: 13,
	fees: ['1/10000', '1/10000']
});
Object.assign(config.props['KQ.m@SHFE.ru'], { //橡胶主连
	marg: 14,
	fees: ['3', '0']
});
Object.assign(config.props['KQ.m@SHFE.sn'], { //沪锡主连
	marg: 18,
	fees: ['3', '3']
});
Object.assign(config.props['KQ.m@SHFE.sp'], { //纸浆主连
	marg: 13,
	fees: ['0.2/10000', '0']
});
Object.assign(config.props['KQ.m@SHFE.ss'], { //不锈钢主连
	marg: 13,
	fees: ['2', '0']
});
Object.assign(config.props['KQ.m@SHFE.wr'], { //线材主连
	marg: 17,
	fees: ['0.4/10000', '0']
});
Object.assign(config.props['KQ.m@SHFE.zn'], { //沪锌主连
	marg: 14,
	fees: ['3', '0']
});
/** 与主连有差异的标的 **/
config.props['CZCE.AP611'] = { //苹果2611
	marg: 25
};
config.props['CZCE.CF611'] = { //棉花2611
	marg: 25
};
config.props['CZCE.CJ612'] = { //红枣2612
	marg: 15
};
config.props['CZCE.CY611'] = { //棉纱2611
	marg: 30
};
config.props['CZCE.FG611'] = { //玻璃2611
	marg: 26
};
config.props['CZCE.JR611'] = { //粳稻2611
	marg: 30
};
config.props['CZCE.MA611'] = { //甲醇2611
	marg: 27
};
config.props['CZCE.MA612'] = { //甲醇2612
	marg: 16
};
config.props['CZCE.MA701'] = { //甲醇2701
	marg: 16
};
config.props['CZCE.OI611'] = { //菜油2611
	marg: 26
};
config.props['CZCE.PF611'] = { //短纤2611
	marg: 26
};
config.props['CZCE.PK611'] = { //花生仁2611
	marg: 26
};
config.props['CZCE.PL611'] = { //丙烯2611
	marg: 27
};
config.props['CZCE.PM611'] = { //普麦2611
	marg: 45
};
config.props['CZCE.PR611'] = { //瓶片2611
	marg: 26
};
config.props['CZCE.PX611'] = { //对二甲苯2611
	marg: 27
};
config.props['CZCE.PX612'] = { //对二甲苯2612
	marg: 17
};
config.props['CZCE.PX701'] = { //对二甲苯2701
	marg: 16
};
config.props['CZCE.RI611'] = { //早稻2611
	marg: 30
};
config.props['CZCE.RM611'] = { //菜粕2611
	marg: 26
};
config.props['CZCE.RS611'] = { //菜籽2611
	marg: 37
};
config.props['CZCE.SA611'] = { //纯碱2611
	marg: 26
};
config.props['CZCE.SF611'] = { //硅铁2611
	marg: 26
};
config.props['CZCE.SH611'] = { //烧碱2611
	marg: 26
};
config.props['CZCE.SM611'] = { //锰硅2611
	marg: 26
};
config.props['CZCE.SR611'] = { //白糖2611
	marg: 26
};
config.props['CZCE.TA611'] = { //PTA2611
	marg: 27
};
config.props['CZCE.TA612'] = { //PTA2612
	marg: 16
};
config.props['CZCE.TA701'] = { //PTA2701
	marg: 16
};
config.props['CZCE.UR611'] = { //尿素2611
	marg: 25
};
config.props['CZCE.WH611'] = { //强麦2611
	marg: 45
};
config.props['DCE.a2611'] = { //豆一2611
	marg: 25
};
config.props['DCE.b2611'] = { //豆二2611
	marg: 26
};
config.props['DCE.bb2611'] = { //胶板2611
	marg: 42
};
config.props['DCE.bz2611'] = { //纯苯2611
	marg: 27
};
config.props['DCE.c2611'] = { //玉米2611
	marg: 25
};
config.props['DCE.cs2611'] = { //淀粉2611
	marg: 25
};
config.props['DCE.eb2611'] = { //苯乙烯2611
	marg: 27
};
config.props['DCE.eg2611'] = { //甘醇2611
	marg: 27
};
config.props['DCE.fb2611'] = { //纤板2611
	marg: 35
};
config.props['DCE.i2611'] = { //铁矿2611
	marg: 26
};
config.props['DCE.j2611'] = { //焦炭2611
	marg: 25
};
config.props['DCE.jd2611'] = { //鸡蛋2611
	marg: 26
};
config.props['DCE.jm2611'] = { //焦煤2611
	marg: 25
};
config.props['DCE.l2611'] = { //聚乙烯2611
	marg: 26
};
config.props['DCE.lg2611'] = { //原木2611
	marg: 25
};
config.props['DCE.lh2611'] = { //生猪2611
	marg: 26
};
config.props['DCE.lh2707'] = { //生猪2707
	marg: 14
};
config.props['DCE.lh2709'] = { //生猪2709
	marg: 14
};
config.props['DCE.m2611'] = { //豆粕2611
	marg: 26
};
config.props['DCE.p2611'] = { //棕榈2611
	marg: 25
};
config.props['DCE.pg2611'] = { //LPG2611
	marg: 27
};
config.props['DCE.pg2612'] = { //LPG2612
	marg: 18
};
config.props['DCE.pg2701'] = { //LPG2701
	marg: 18
};
config.props['DCE.pg2702'] = { //LPG2702
	marg: 18
};
config.props['DCE.pp2611'] = { //PP2611
	marg: 26
};
config.props['DCE.rr2611'] = { //粳米2611
	marg: 25
};
config.props['DCE.v2611'] = { //PVC2611
	marg: 26
};
config.props['DCE.y2611'] = { //豆油2611
	marg: 26
};
config.props['GFEX.lc2611'] = { //碳酸锂2611
	marg: 27
};
config.props['GFEX.ps2611'] = { //多晶硅2611
	marg: 27
};
config.props['GFEX.si2611'] = { //工业硅2611
	marg: 27
};
config.props['INE.bc2611'] = { //国际铜2611
	marg: 20
};
config.props['INE.bc2612'] = { //国际铜2612
	marg: 16
};
config.props['INE.bc2701'] = { //国际铜2701
	marg: 16
};
config.props['INE.bc2702'] = { //国际铜2702
	marg: 16
};
config.props['INE.ec2612'] = { //欧线集运2612
	marg: 31
};
config.props['INE.ec2703'] = { //欧线集运2703
	marg: 31
};
config.props['INE.lu2612'] = { //低硫燃料油2612
	marg: 26
};
config.props['INE.lu2701'] = { //低硫燃料油2701
	marg: 26
};
config.props['INE.nr2611'] = { //20号胶2611
	marg: 20
};
config.props['INE.nr2612'] = { //20号胶2612
	marg: 15
};
config.props['INE.sc2612'] = { //原油2612
	marg: 26
};
config.props['INE.sc2701'] = { //原油2701
	marg: 26
};
config.props['SHFE.ad2611'] = { //铝合金2611
	marg: 21
};
config.props['SHFE.ad2612'] = { //铝合金2612
	marg: 16
};
config.props['SHFE.ad2701'] = { //铝合金2701
	marg: 16
};
config.props['SHFE.ad2702'] = { //铝合金2702
	marg: 16
};
config.props['SHFE.ag2702'] = { //沪银2702
	fees: ['0.1/10000', '0.1/10000']
};
config.props['SHFE.ag2703'] = { //沪银2703
	fees: ['0.1/10000', '0.1/10000']
};
config.props['SHFE.ag2704'] = { //沪银2704
	fees: ['0.1/10000', '0.1/10000']
};
config.props['SHFE.ag2705'] = { //沪银2705
	marg: 26,
	fees: ['0.1/10000', '0.1/10000']
};
config.props['SHFE.ag2706'] = { //沪银2706
	marg: 26
};
config.props['SHFE.ag2707'] = { //沪银2707
	marg: 23,
	fees: ['0.1/10000', '0.1/10000']
};
config.props['SHFE.ag2708'] = { //沪银2708
	marg: 23,
	fees: ['0.1/10000', '0.1/10000']
};
config.props['SHFE.ag2709'] = { //沪银2709
	marg: 23,
	fees: ['0.1/10000', '0.1/10000']
};
config.props['SHFE.ag2710'] = { //沪银2710
	marg: 23,
	fees: ['0.1/10000', '0.1/10000']
};
config.props['SHFE.al2611'] = { //沪铝2611
	marg: 20
};
config.props['SHFE.al2612'] = { //沪铝2612
	marg: 16
};
config.props['SHFE.al2701'] = { //沪铝2701
	marg: 16
};
config.props['SHFE.al2702'] = { //沪铝2702
	marg: 16
};
config.props['SHFE.ao2611'] = { //氧化铝2611
	marg: 20
};
config.props['SHFE.ao2612'] = { //氧化铝2612
	marg: 16
};
config.props['SHFE.ao2701'] = { //氧化铝2701
	marg: 16
};
config.props['SHFE.ao2702'] = { //氧化铝2702
	marg: 16
};
config.props['SHFE.au2702'] = { //沪金2702
	fees: ['10', '0']
};
config.props['SHFE.au2704'] = { //沪金2704
	fees: ['10', '0']
};
config.props['SHFE.au2708'] = { //沪金2708
	fees: ['10', '0']
};
config.props['SHFE.au2710'] = { //沪金2710
	fees: ['10', '0']
};
config.props['SHFE.br2611'] = { //丁橡胶2611
	marg: 20
};
config.props['SHFE.bu2611'] = { //沥青2611
	marg: 22
};
config.props['SHFE.bu2612'] = { //沥青2612
	marg: 22
};
config.props['SHFE.bu2701'] = { //沥青2701
	marg: 22
};
config.props['SHFE.cu2611'] = { //沪铜2611
	marg: 20
};
config.props['SHFE.cu2612'] = { //沪铜2612
	marg: 16
};
config.props['SHFE.cu2701'] = { //沪铜2701
	marg: 16
};
config.props['SHFE.cu2702'] = { //沪铜2702
	marg: 16
};
config.props['SHFE.fu2612'] = { //燃油2612
	marg: 26
};
config.props['SHFE.fu2701'] = { //燃油2701
	marg: 26
};
config.props['SHFE.fu2702'] = { //燃油2702
	fees: ['0.1/10000', '0']
};
config.props['SHFE.fu2703'] = { //燃油2703
	fees: ['0.1/10000', '0']
};
config.props['SHFE.fu2704'] = { //燃油2704
	fees: ['0.1/10000', '0']
};
config.props['SHFE.fu2706'] = { //燃油2706
	fees: ['0.1/10000', '0']
};
config.props['SHFE.fu2707'] = { //燃油2707
	fees: ['0.1/10000', '0']
};
config.props['SHFE.fu2708'] = { //燃油2708
	fees: ['0.1/10000', '0']
};
config.props['SHFE.fu2710'] = { //燃油2710
	fees: ['0.1/10000', '0']
};
config.props['SHFE.fu2711'] = { //燃油2711
	fees: ['0.1/10000', '0']
};
config.props['SHFE.hc2611'] = { //热卷2611
	marg: 21
};
config.props['SHFE.hc2612'] = { //热卷2612
	marg: 16
};
config.props['SHFE.hc2702'] = { //热卷2702
	fees: ['0.2/10000', '0.2/10000']
};
config.props['SHFE.hc2703'] = { //热卷2703
	fees: ['0.2/10000', '0.2/10000']
};
config.props['SHFE.hc2704'] = { //热卷2704
	fees: ['0.2/10000', '0.2/10000']
};
config.props['SHFE.hc2706'] = { //热卷2706
	fees: ['0.2/10000', '0.2/10000']
};
config.props['SHFE.hc2707'] = { //热卷2707
	fees: ['0.2/10000', '0.2/10000']
};
config.props['SHFE.hc2708'] = { //热卷2708
	fees: ['0.2/10000', '0.2/10000']
};
config.props['SHFE.hc2709'] = { //热卷2709
	fees: ['0.2/10000', '0.2/10000']
};
config.props['SHFE.ni2611'] = { //沪镍2611
	marg: 20
};
config.props['SHFE.ni2612'] = { //沪镍2612
	marg: 17
};
config.props['SHFE.ni2701'] = { //沪镍2701
	marg: 17
};
config.props['SHFE.ni2702'] = { //沪镍2702
	marg: 17
};
config.props['SHFE.ni2703'] = { //沪镍2703
	marg: 17
};
config.props['SHFE.op2611'] = { //胶版纸2611
	marg: 21
};
config.props['SHFE.op2612'] = { //胶版纸2612
	marg: 16
};
config.props['SHFE.pb2611'] = { //沪铅2611
	marg: 20
};
config.props['SHFE.pb2612'] = { //沪铅2612
	marg: 16
};
config.props['SHFE.pb2701'] = { //沪铅2701
	marg: 16
};
config.props['SHFE.pb2702'] = { //沪铅2702
	marg: 16
};
config.props['SHFE.rb2611'] = { //螺纹2611
	marg: 21
};
config.props['SHFE.rb2612'] = { //螺纹2612
	marg: 16
};
config.props['SHFE.rb2702'] = { //螺纹2702
	fees: ['0.2/10000', '0.2/10000']
};
config.props['SHFE.rb2703'] = { //螺纹2703
	fees: ['0.2/10000', '0.2/10000']
};
config.props['SHFE.rb2704'] = { //螺纹2704
	fees: ['0.2/10000', '0.2/10000']
};
config.props['SHFE.rb2706'] = { //螺纹2706
	fees: ['0.2/10000', '0.2/10000']
};
config.props['SHFE.rb2707'] = { //螺纹2707
	fees: ['0.2/10000', '0.2/10000']
};
config.props['SHFE.rb2708'] = { //螺纹2708
	fees: ['0.2/10000', '0.2/10000']
};
config.props['SHFE.rb2709'] = { //螺纹2709
	fees: ['0.2/10000', '0.2/10000']
};
config.props['SHFE.ru2611'] = { //橡胶2611
	marg: 20
};
config.props['SHFE.sn2611'] = { //沪锡2611
	marg: 20
};
config.props['SHFE.sn2612'] = { //沪锡2612
	marg: 19
};
config.props['SHFE.sn2701'] = { //沪锡2701
	marg: 19
};
config.props['SHFE.sn2702'] = { //沪锡2702
	marg: 19
};
config.props['SHFE.sn2703'] = { //沪锡2703
	marg: 19
};
config.props['SHFE.sp2611'] = { //纸浆2611
	marg: 21
};
config.props['SHFE.sp2612'] = { //纸浆2612
	marg: 16
};
config.props['SHFE.ss2611'] = { //不锈钢2611
	marg: 21
};
config.props['SHFE.ss2612'] = { //不锈钢2612
	marg: 16
};
config.props['SHFE.wr2611'] = { //线材2611
	marg: 20
};
config.props['SHFE.zn2611'] = { //沪锌2611
	marg: 20
};
config.props['SHFE.zn2612'] = { //沪锌2612
	marg: 16
};
config.props['SHFE.zn2701'] = { //沪锌2701
	marg: 16
};
config.props['SHFE.zn2702'] = { //沪锌2702
	marg: 16
};
