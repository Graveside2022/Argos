/*! For license information please see 266.7edb3bb5.chunk.js.LICENSE.txt */
!(function () {
	'use strict';
	var t = {
			2266: function (t, e, o) {
				function n(t, e, o, n, r, i, a) {
					try {
						var c = t[i](a),
							s = c.value;
					} catch (l) {
						return void o(l);
					}
					c.done ? e(s) : Promise.resolve(s).then(n, r);
				}
				function r(t, e, o) {
					return (
						e in t
							? Object.defineProperty(t, e, {
									value: o,
									enumerable: !0,
									configurable: !0,
									writable: !0
								})
							: (t[e] = o),
						t
					);
				}
				function i(t, e) {
					if (!(t instanceof e)) throw new TypeError('Cannot call a class as a function');
				}
				function a(t, e) {
					for (var o = 0; o < e.length; o++) {
						var n = e[o];
						((n.enumerable = n.enumerable || !1),
							(n.configurable = !0),
							'value' in n && (n.writable = !0),
							Object.defineProperty(t, n.key, n));
					}
				}
				function c(t, e) {
					return (
						(c =
							Object.setPrototypeOf ||
							function (t, e) {
								return ((t.__proto__ = e), t);
							}),
						c(t, e)
					);
				}
				function s(t) {
					return (
						(s = Object.setPrototypeOf
							? Object.getPrototypeOf
							: function (t) {
									return t.__proto__ || Object.getPrototypeOf(t);
								}),
						s(t)
					);
				}
				function l(t) {
					return (
						(l =
							'function' == typeof Symbol && 'symbol' == typeof Symbol.iterator
								? function (t) {
										return typeof t;
									}
								: function (t) {
										return t &&
											'function' == typeof Symbol &&
											t.constructor === Symbol &&
											t !== Symbol.prototype
											? 'symbol'
											: typeof t;
									}),
						l(t)
					);
				}
				function u(t, e) {
					if (e && ('object' === l(e) || 'function' === typeof e)) return e;
					if (void 0 !== e)
						throw new TypeError(
							'Derived constructors may only return object or undefined'
						);
					return (function (t) {
						if (void 0 === t)
							throw new ReferenceError(
								"this hasn't been initialised - super() hasn't been called"
							);
						return t;
					})(t);
				}
				function p(t) {
					var e = (function () {
						if ('undefined' === typeof Reflect || !Reflect.construct) return !1;
						if (Reflect.construct.sham) return !1;
						if ('function' === typeof Proxy) return !0;
						try {
							return (
								Boolean.prototype.valueOf.call(
									Reflect.construct(Boolean, [], function () {})
								),
								!0
							);
						} catch (t) {
							return !1;
						}
					})();
					return function () {
						var o,
							n = s(t);
						if (e) {
							var r = s(this).constructor;
							o = Reflect.construct(n, arguments, r);
						} else o = n.apply(this, arguments);
						return u(this, o);
					};
				}
				var m = o(7796),
					f = m.Reader,
					d = m.Writer,
					v = m.util,
					h = m.roots.default || (m.roots.default = {});
				h.atakmap = (function () {
					var t = {};
					return (
						(t.commoncommo = (function () {
							var t = {};
							return (
								(t.protobuf = (function () {
									var t = {};
									return (
										(t.v1 = (function () {
											var t = {};
											return (
												(t.Contact = (function () {
													function t(t) {
														if (t)
															for (
																var e = Object.keys(t), o = 0;
																o < e.length;
																++o
															)
																null != t[e[o]] &&
																	(this[e[o]] = t[e[o]]);
													}
													return (
														(t.prototype.endpoint = ''),
														(t.prototype.callsign = ''),
														(t.create = function (e) {
															return new t(e);
														}),
														(t.encode = function (t, e) {
															return (
																e || (e = d.create()),
																null != t.endpoint &&
																	Object.hasOwnProperty.call(
																		t,
																		'endpoint'
																	) &&
																	e.uint32(10).string(t.endpoint),
																null != t.callsign &&
																	Object.hasOwnProperty.call(
																		t,
																		'callsign'
																	) &&
																	e.uint32(18).string(t.callsign),
																e
															);
														}),
														(t.encodeDelimited = function (t, e) {
															return this.encode(t, e).ldelim();
														}),
														(t.decode = function (t, e) {
															t instanceof f || (t = f.create(t));
															for (
																var o =
																		void 0 === e
																			? t.len
																			: t.pos + e,
																	n =
																		new h.atakmap.commoncommo.protobuf.v1.Contact();
																t.pos < o;

															) {
																var r = t.uint32();
																switch (r >>> 3) {
																	case 1:
																		n.endpoint = t.string();
																		break;
																	case 2:
																		n.callsign = t.string();
																		break;
																	default:
																		t.skipType(7 & r);
																}
															}
															return n;
														}),
														(t.decodeDelimited = function (t) {
															return (
																t instanceof f || (t = new f(t)),
																this.decode(t, t.uint32())
															);
														}),
														(t.verify = function (t) {
															return 'object' !== typeof t ||
																null === t
																? 'object expected'
																: null != t.endpoint &&
																	  t.hasOwnProperty(
																			'endpoint'
																	  ) &&
																	  !v.isString(t.endpoint)
																	? 'endpoint: string expected'
																	: null != t.callsign &&
																		  t.hasOwnProperty(
																				'callsign'
																		  ) &&
																		  !v.isString(t.callsign)
																		? 'callsign: string expected'
																		: null;
														}),
														(t.fromObject = function (t) {
															if (
																t instanceof
																h.atakmap.commoncommo.protobuf.v1
																	.Contact
															)
																return t;
															var e =
																new h.atakmap.commoncommo.protobuf.v1.Contact();
															return (
																null != t.endpoint &&
																	(e.endpoint = String(
																		t.endpoint
																	)),
																null != t.callsign &&
																	(e.callsign = String(
																		t.callsign
																	)),
																e
															);
														}),
														(t.toObject = function (t, e) {
															e || (e = {});
															var o = {};
															return (
																e.defaults &&
																	((o.endpoint = ''),
																	(o.callsign = '')),
																null != t.endpoint &&
																	t.hasOwnProperty('endpoint') &&
																	(o.endpoint = t.endpoint),
																null != t.callsign &&
																	t.hasOwnProperty('callsign') &&
																	(o.callsign = t.callsign),
																o
															);
														}),
														(t.prototype.toJSON = function () {
															return this.constructor.toObject(
																this,
																m.util.toJSONOptions
															);
														}),
														t
													);
												})()),
												(t.CotEvent = (function () {
													function t(t) {
														if (t)
															for (
																var e = Object.keys(t), o = 0;
																o < e.length;
																++o
															)
																null != t[e[o]] &&
																	(this[e[o]] = t[e[o]]);
													}
													return (
														(t.prototype.type = ''),
														(t.prototype.access = ''),
														(t.prototype.qos = ''),
														(t.prototype.opex = ''),
														(t.prototype.uid = ''),
														(t.prototype.sendTime = v.Long
															? v.Long.fromBits(0, 0, !0)
															: 0),
														(t.prototype.startTime = v.Long
															? v.Long.fromBits(0, 0, !0)
															: 0),
														(t.prototype.staleTime = v.Long
															? v.Long.fromBits(0, 0, !0)
															: 0),
														(t.prototype.how = ''),
														(t.prototype.lat = 0),
														(t.prototype.lon = 0),
														(t.prototype.hae = 0),
														(t.prototype.ce = 0),
														(t.prototype.le = 0),
														(t.prototype.detail = null),
														(t.create = function (e) {
															return new t(e);
														}),
														(t.encode = function (t, e) {
															return (
																e || (e = d.create()),
																null != t.type &&
																	Object.hasOwnProperty.call(
																		t,
																		'type'
																	) &&
																	e.uint32(10).string(t.type),
																null != t.access &&
																	Object.hasOwnProperty.call(
																		t,
																		'access'
																	) &&
																	e.uint32(18).string(t.access),
																null != t.qos &&
																	Object.hasOwnProperty.call(
																		t,
																		'qos'
																	) &&
																	e.uint32(26).string(t.qos),
																null != t.opex &&
																	Object.hasOwnProperty.call(
																		t,
																		'opex'
																	) &&
																	e.uint32(34).string(t.opex),
																null != t.uid &&
																	Object.hasOwnProperty.call(
																		t,
																		'uid'
																	) &&
																	e.uint32(42).string(t.uid),
																null != t.sendTime &&
																	Object.hasOwnProperty.call(
																		t,
																		'sendTime'
																	) &&
																	e.uint32(48).uint64(t.sendTime),
																null != t.startTime &&
																	Object.hasOwnProperty.call(
																		t,
																		'startTime'
																	) &&
																	e
																		.uint32(56)
																		.uint64(t.startTime),
																null != t.staleTime &&
																	Object.hasOwnProperty.call(
																		t,
																		'staleTime'
																	) &&
																	e
																		.uint32(64)
																		.uint64(t.staleTime),
																null != t.how &&
																	Object.hasOwnProperty.call(
																		t,
																		'how'
																	) &&
																	e.uint32(74).string(t.how),
																null != t.lat &&
																	Object.hasOwnProperty.call(
																		t,
																		'lat'
																	) &&
																	e.uint32(81).double(t.lat),
																null != t.lon &&
																	Object.hasOwnProperty.call(
																		t,
																		'lon'
																	) &&
																	e.uint32(89).double(t.lon),
																null != t.hae &&
																	Object.hasOwnProperty.call(
																		t,
																		'hae'
																	) &&
																	e.uint32(97).double(t.hae),
																null != t.ce &&
																	Object.hasOwnProperty.call(
																		t,
																		'ce'
																	) &&
																	e.uint32(105).double(t.ce),
																null != t.le &&
																	Object.hasOwnProperty.call(
																		t,
																		'le'
																	) &&
																	e.uint32(113).double(t.le),
																null != t.detail &&
																	Object.hasOwnProperty.call(
																		t,
																		'detail'
																	) &&
																	h.atakmap.commoncommo.protobuf.v1.Detail.encode(
																		t.detail,
																		e.uint32(122).fork()
																	).ldelim(),
																e
															);
														}),
														(t.encodeDelimited = function (t, e) {
															return this.encode(t, e).ldelim();
														}),
														(t.decode = function (t, e) {
															t instanceof f || (t = f.create(t));
															for (
																var o =
																		void 0 === e
																			? t.len
																			: t.pos + e,
																	n =
																		new h.atakmap.commoncommo.protobuf.v1.CotEvent();
																t.pos < o;

															) {
																var r = t.uint32();
																switch (r >>> 3) {
																	case 1:
																		n.type = t.string();
																		break;
																	case 2:
																		n.access = t.string();
																		break;
																	case 3:
																		n.qos = t.string();
																		break;
																	case 4:
																		n.opex = t.string();
																		break;
																	case 5:
																		n.uid = t.string();
																		break;
																	case 6:
																		n.sendTime = t.uint64();
																		break;
																	case 7:
																		n.startTime = t.uint64();
																		break;
																	case 8:
																		n.staleTime = t.uint64();
																		break;
																	case 9:
																		n.how = t.string();
																		break;
																	case 10:
																		n.lat = t.double();
																		break;
																	case 11:
																		n.lon = t.double();
																		break;
																	case 12:
																		n.hae = t.double();
																		break;
																	case 13:
																		n.ce = t.double();
																		break;
																	case 14:
																		n.le = t.double();
																		break;
																	case 15:
																		n.detail =
																			h.atakmap.commoncommo.protobuf.v1.Detail.decode(
																				t,
																				t.uint32()
																			);
																		break;
																	default:
																		t.skipType(7 & r);
																}
															}
															return n;
														}),
														(t.decodeDelimited = function (t) {
															return (
																t instanceof f || (t = new f(t)),
																this.decode(t, t.uint32())
															);
														}),
														(t.verify = function (t) {
															if ('object' !== typeof t || null === t)
																return 'object expected';
															if (
																null != t.type &&
																t.hasOwnProperty('type') &&
																!v.isString(t.type)
															)
																return 'type: string expected';
															if (
																null != t.access &&
																t.hasOwnProperty('access') &&
																!v.isString(t.access)
															)
																return 'access: string expected';
															if (
																null != t.qos &&
																t.hasOwnProperty('qos') &&
																!v.isString(t.qos)
															)
																return 'qos: string expected';
															if (
																null != t.opex &&
																t.hasOwnProperty('opex') &&
																!v.isString(t.opex)
															)
																return 'opex: string expected';
															if (
																null != t.uid &&
																t.hasOwnProperty('uid') &&
																!v.isString(t.uid)
															)
																return 'uid: string expected';
															if (
																null != t.sendTime &&
																t.hasOwnProperty('sendTime') &&
																!v.isInteger(t.sendTime) &&
																!(
																	t.sendTime &&
																	v.isInteger(t.sendTime.low) &&
																	v.isInteger(t.sendTime.high)
																)
															)
																return 'sendTime: integer|Long expected';
															if (
																null != t.startTime &&
																t.hasOwnProperty('startTime') &&
																!v.isInteger(t.startTime) &&
																!(
																	t.startTime &&
																	v.isInteger(t.startTime.low) &&
																	v.isInteger(t.startTime.high)
																)
															)
																return 'startTime: integer|Long expected';
															if (
																null != t.staleTime &&
																t.hasOwnProperty('staleTime') &&
																!v.isInteger(t.staleTime) &&
																!(
																	t.staleTime &&
																	v.isInteger(t.staleTime.low) &&
																	v.isInteger(t.staleTime.high)
																)
															)
																return 'staleTime: integer|Long expected';
															if (
																null != t.how &&
																t.hasOwnProperty('how') &&
																!v.isString(t.how)
															)
																return 'how: string expected';
															if (
																null != t.lat &&
																t.hasOwnProperty('lat') &&
																'number' !== typeof t.lat
															)
																return 'lat: number expected';
															if (
																null != t.lon &&
																t.hasOwnProperty('lon') &&
																'number' !== typeof t.lon
															)
																return 'lon: number expected';
															if (
																null != t.hae &&
																t.hasOwnProperty('hae') &&
																'number' !== typeof t.hae
															)
																return 'hae: number expected';
															if (
																null != t.ce &&
																t.hasOwnProperty('ce') &&
																'number' !== typeof t.ce
															)
																return 'ce: number expected';
															if (
																null != t.le &&
																t.hasOwnProperty('le') &&
																'number' !== typeof t.le
															)
																return 'le: number expected';
															if (
																null != t.detail &&
																t.hasOwnProperty('detail')
															) {
																var e =
																	h.atakmap.commoncommo.protobuf.v1.Detail.verify(
																		t.detail
																	);
																if (e) return 'detail.' + e;
															}
															return null;
														}),
														(t.fromObject = function (t) {
															if (
																t instanceof
																h.atakmap.commoncommo.protobuf.v1
																	.CotEvent
															)
																return t;
															var e =
																new h.atakmap.commoncommo.protobuf.v1.CotEvent();
															if (
																(null != t.type &&
																	(e.type = String(t.type)),
																null != t.access &&
																	(e.access = String(t.access)),
																null != t.qos &&
																	(e.qos = String(t.qos)),
																null != t.opex &&
																	(e.opex = String(t.opex)),
																null != t.uid &&
																	(e.uid = String(t.uid)),
																null != t.sendTime &&
																	(v.Long
																		? ((e.sendTime =
																				v.Long.fromValue(
																					t.sendTime
																				)).unsigned = !0)
																		: 'string' ===
																			  typeof t.sendTime
																			? (e.sendTime =
																					parseInt(
																						t.sendTime,
																						10
																					))
																			: 'number' ===
																				  typeof t.sendTime
																				? (e.sendTime =
																						t.sendTime)
																				: 'object' ===
																						typeof t.sendTime &&
																					(e.sendTime =
																						new v.LongBits(
																							t
																								.sendTime
																								.low >>>
																								0,
																							t
																								.sendTime
																								.high >>>
																								0
																						).toNumber(
																							!0
																						))),
																null != t.startTime &&
																	(v.Long
																		? ((e.startTime =
																				v.Long.fromValue(
																					t.startTime
																				)).unsigned = !0)
																		: 'string' ===
																			  typeof t.startTime
																			? (e.startTime =
																					parseInt(
																						t.startTime,
																						10
																					))
																			: 'number' ===
																				  typeof t.startTime
																				? (e.startTime =
																						t.startTime)
																				: 'object' ===
																						typeof t.startTime &&
																					(e.startTime =
																						new v.LongBits(
																							t
																								.startTime
																								.low >>>
																								0,
																							t
																								.startTime
																								.high >>>
																								0
																						).toNumber(
																							!0
																						))),
																null != t.staleTime &&
																	(v.Long
																		? ((e.staleTime =
																				v.Long.fromValue(
																					t.staleTime
																				)).unsigned = !0)
																		: 'string' ===
																			  typeof t.staleTime
																			? (e.staleTime =
																					parseInt(
																						t.staleTime,
																						10
																					))
																			: 'number' ===
																				  typeof t.staleTime
																				? (e.staleTime =
																						t.staleTime)
																				: 'object' ===
																						typeof t.staleTime &&
																					(e.staleTime =
																						new v.LongBits(
																							t
																								.staleTime
																								.low >>>
																								0,
																							t
																								.staleTime
																								.high >>>
																								0
																						).toNumber(
																							!0
																						))),
																null != t.how &&
																	(e.how = String(t.how)),
																null != t.lat &&
																	(e.lat = Number(t.lat)),
																null != t.lon &&
																	(e.lon = Number(t.lon)),
																null != t.hae &&
																	(e.hae = Number(t.hae)),
																null != t.ce &&
																	(e.ce = Number(t.ce)),
																null != t.le &&
																	(e.le = Number(t.le)),
																null != t.detail)
															) {
																if ('object' !== typeof t.detail)
																	throw TypeError(
																		'.atakmap.commoncommo.protobuf.v1.CotEvent.detail: object expected'
																	);
																e.detail =
																	h.atakmap.commoncommo.protobuf.v1.Detail.fromObject(
																		t.detail
																	);
															}
															return e;
														}),
														(t.toObject = function (t, e) {
															e || (e = {});
															var o = {};
															if (e.defaults) {
																if (
																	((o.type = ''),
																	(o.access = ''),
																	(o.qos = ''),
																	(o.opex = ''),
																	(o.uid = ''),
																	v.Long)
																) {
																	var n = new v.Long(0, 0, !0);
																	o.sendTime =
																		e.longs === String
																			? n.toString()
																			: e.longs === Number
																				? n.toNumber()
																				: n;
																} else
																	o.sendTime =
																		e.longs === String
																			? '0'
																			: 0;
																if (v.Long) {
																	var r = new v.Long(0, 0, !0);
																	o.startTime =
																		e.longs === String
																			? r.toString()
																			: e.longs === Number
																				? r.toNumber()
																				: r;
																} else
																	o.startTime =
																		e.longs === String
																			? '0'
																			: 0;
																if (v.Long) {
																	var i = new v.Long(0, 0, !0);
																	o.staleTime =
																		e.longs === String
																			? i.toString()
																			: e.longs === Number
																				? i.toNumber()
																				: i;
																} else
																	o.staleTime =
																		e.longs === String
																			? '0'
																			: 0;
																((o.how = ''),
																	(o.lat = 0),
																	(o.lon = 0),
																	(o.hae = 0),
																	(o.ce = 0),
																	(o.le = 0),
																	(o.detail = null));
															}
															return (
																null != t.type &&
																	t.hasOwnProperty('type') &&
																	(o.type = t.type),
																null != t.access &&
																	t.hasOwnProperty('access') &&
																	(o.access = t.access),
																null != t.qos &&
																	t.hasOwnProperty('qos') &&
																	(o.qos = t.qos),
																null != t.opex &&
																	t.hasOwnProperty('opex') &&
																	(o.opex = t.opex),
																null != t.uid &&
																	t.hasOwnProperty('uid') &&
																	(o.uid = t.uid),
																null != t.sendTime &&
																	t.hasOwnProperty('sendTime') &&
																	('number' === typeof t.sendTime
																		? (o.sendTime =
																				e.longs === String
																					? String(
																							t.sendTime
																						)
																					: t.sendTime)
																		: (o.sendTime =
																				e.longs === String
																					? v.Long.prototype.toString.call(
																							t.sendTime
																						)
																					: e.longs ===
																						  Number
																						? new v.LongBits(
																								t
																									.sendTime
																									.low >>>
																									0,
																								t
																									.sendTime
																									.high >>>
																									0
																							).toNumber(
																								!0
																							)
																						: t.sendTime)),
																null != t.startTime &&
																	t.hasOwnProperty('startTime') &&
																	('number' === typeof t.startTime
																		? (o.startTime =
																				e.longs === String
																					? String(
																							t.startTime
																						)
																					: t.startTime)
																		: (o.startTime =
																				e.longs === String
																					? v.Long.prototype.toString.call(
																							t.startTime
																						)
																					: e.longs ===
																						  Number
																						? new v.LongBits(
																								t
																									.startTime
																									.low >>>
																									0,
																								t
																									.startTime
																									.high >>>
																									0
																							).toNumber(
																								!0
																							)
																						: t.startTime)),
																null != t.staleTime &&
																	t.hasOwnProperty('staleTime') &&
																	('number' === typeof t.staleTime
																		? (o.staleTime =
																				e.longs === String
																					? String(
																							t.staleTime
																						)
																					: t.staleTime)
																		: (o.staleTime =
																				e.longs === String
																					? v.Long.prototype.toString.call(
																							t.staleTime
																						)
																					: e.longs ===
																						  Number
																						? new v.LongBits(
																								t
																									.staleTime
																									.low >>>
																									0,
																								t
																									.staleTime
																									.high >>>
																									0
																							).toNumber(
																								!0
																							)
																						: t.staleTime)),
																null != t.how &&
																	t.hasOwnProperty('how') &&
																	(o.how = t.how),
																null != t.lat &&
																	t.hasOwnProperty('lat') &&
																	(o.lat =
																		e.json && !isFinite(t.lat)
																			? String(t.lat)
																			: t.lat),
																null != t.lon &&
																	t.hasOwnProperty('lon') &&
																	(o.lon =
																		e.json && !isFinite(t.lon)
																			? String(t.lon)
																			: t.lon),
																null != t.hae &&
																	t.hasOwnProperty('hae') &&
																	(o.hae =
																		e.json && !isFinite(t.hae)
																			? String(t.hae)
																			: t.hae),
																null != t.ce &&
																	t.hasOwnProperty('ce') &&
																	(o.ce =
																		e.json && !isFinite(t.ce)
																			? String(t.ce)
																			: t.ce),
																null != t.le &&
																	t.hasOwnProperty('le') &&
																	(o.le =
																		e.json && !isFinite(t.le)
																			? String(t.le)
																			: t.le),
																null != t.detail &&
																	t.hasOwnProperty('detail') &&
																	(o.detail =
																		h.atakmap.commoncommo.protobuf.v1.Detail.toObject(
																			t.detail,
																			e
																		)),
																o
															);
														}),
														(t.prototype.toJSON = function () {
															return this.constructor.toObject(
																this,
																m.util.toJSONOptions
															);
														}),
														t
													);
												})()),
												(t.Detail = (function () {
													function t(t) {
														if (t)
															for (
																var e = Object.keys(t), o = 0;
																o < e.length;
																++o
															)
																null != t[e[o]] &&
																	(this[e[o]] = t[e[o]]);
													}
													return (
														(t.prototype.xmlDetail = ''),
														(t.prototype.contact = null),
														(t.prototype.group = null),
														(t.prototype.precisionLocation = null),
														(t.prototype.status = null),
														(t.prototype.takv = null),
														(t.prototype.track = null),
														(t.create = function (e) {
															return new t(e);
														}),
														(t.encode = function (t, e) {
															return (
																e || (e = d.create()),
																null != t.xmlDetail &&
																	Object.hasOwnProperty.call(
																		t,
																		'xmlDetail'
																	) &&
																	e
																		.uint32(10)
																		.string(t.xmlDetail),
																null != t.contact &&
																	Object.hasOwnProperty.call(
																		t,
																		'contact'
																	) &&
																	h.atakmap.commoncommo.protobuf.v1.Contact.encode(
																		t.contact,
																		e.uint32(18).fork()
																	).ldelim(),
																null != t.group &&
																	Object.hasOwnProperty.call(
																		t,
																		'group'
																	) &&
																	h.atakmap.commoncommo.protobuf.v1.Group.encode(
																		t.group,
																		e.uint32(26).fork()
																	).ldelim(),
																null != t.precisionLocation &&
																	Object.hasOwnProperty.call(
																		t,
																		'precisionLocation'
																	) &&
																	h.atakmap.commoncommo.protobuf.v1.PrecisionLocation.encode(
																		t.precisionLocation,
																		e.uint32(34).fork()
																	).ldelim(),
																null != t.status &&
																	Object.hasOwnProperty.call(
																		t,
																		'status'
																	) &&
																	h.atakmap.commoncommo.protobuf.v1.Status.encode(
																		t.status,
																		e.uint32(42).fork()
																	).ldelim(),
																null != t.takv &&
																	Object.hasOwnProperty.call(
																		t,
																		'takv'
																	) &&
																	h.atakmap.commoncommo.protobuf.v1.Takv.encode(
																		t.takv,
																		e.uint32(50).fork()
																	).ldelim(),
																null != t.track &&
																	Object.hasOwnProperty.call(
																		t,
																		'track'
																	) &&
																	h.atakmap.commoncommo.protobuf.v1.Track.encode(
																		t.track,
																		e.uint32(58).fork()
																	).ldelim(),
																e
															);
														}),
														(t.encodeDelimited = function (t, e) {
															return this.encode(t, e).ldelim();
														}),
														(t.decode = function (t, e) {
															t instanceof f || (t = f.create(t));
															for (
																var o =
																		void 0 === e
																			? t.len
																			: t.pos + e,
																	n =
																		new h.atakmap.commoncommo.protobuf.v1.Detail();
																t.pos < o;

															) {
																var r = t.uint32();
																switch (r >>> 3) {
																	case 1:
																		n.xmlDetail = t.string();
																		break;
																	case 2:
																		n.contact =
																			h.atakmap.commoncommo.protobuf.v1.Contact.decode(
																				t,
																				t.uint32()
																			);
																		break;
																	case 3:
																		n.group =
																			h.atakmap.commoncommo.protobuf.v1.Group.decode(
																				t,
																				t.uint32()
																			);
																		break;
																	case 4:
																		n.precisionLocation =
																			h.atakmap.commoncommo.protobuf.v1.PrecisionLocation.decode(
																				t,
																				t.uint32()
																			);
																		break;
																	case 5:
																		n.status =
																			h.atakmap.commoncommo.protobuf.v1.Status.decode(
																				t,
																				t.uint32()
																			);
																		break;
																	case 6:
																		n.takv =
																			h.atakmap.commoncommo.protobuf.v1.Takv.decode(
																				t,
																				t.uint32()
																			);
																		break;
																	case 7:
																		n.track =
																			h.atakmap.commoncommo.protobuf.v1.Track.decode(
																				t,
																				t.uint32()
																			);
																		break;
																	default:
																		t.skipType(7 & r);
																}
															}
															return n;
														}),
														(t.decodeDelimited = function (t) {
															return (
																t instanceof f || (t = new f(t)),
																this.decode(t, t.uint32())
															);
														}),
														(t.verify = function (t) {
															if ('object' !== typeof t || null === t)
																return 'object expected';
															if (
																null != t.xmlDetail &&
																t.hasOwnProperty('xmlDetail') &&
																!v.isString(t.xmlDetail)
															)
																return 'xmlDetail: string expected';
															if (
																null != t.contact &&
																t.hasOwnProperty('contact')
															) {
																var e =
																	h.atakmap.commoncommo.protobuf.v1.Contact.verify(
																		t.contact
																	);
																if (e) return 'contact.' + e;
															}
															if (
																null != t.group &&
																t.hasOwnProperty('group')
															) {
																var o =
																	h.atakmap.commoncommo.protobuf.v1.Group.verify(
																		t.group
																	);
																if (o) return 'group.' + o;
															}
															if (
																null != t.precisionLocation &&
																t.hasOwnProperty(
																	'precisionLocation'
																)
															) {
																var n =
																	h.atakmap.commoncommo.protobuf.v1.PrecisionLocation.verify(
																		t.precisionLocation
																	);
																if (n)
																	return 'precisionLocation.' + n;
															}
															if (
																null != t.status &&
																t.hasOwnProperty('status')
															) {
																var r =
																	h.atakmap.commoncommo.protobuf.v1.Status.verify(
																		t.status
																	);
																if (r) return 'status.' + r;
															}
															if (
																null != t.takv &&
																t.hasOwnProperty('takv')
															) {
																var i =
																	h.atakmap.commoncommo.protobuf.v1.Takv.verify(
																		t.takv
																	);
																if (i) return 'takv.' + i;
															}
															if (
																null != t.track &&
																t.hasOwnProperty('track')
															) {
																var a =
																	h.atakmap.commoncommo.protobuf.v1.Track.verify(
																		t.track
																	);
																if (a) return 'track.' + a;
															}
															return null;
														}),
														(t.fromObject = function (t) {
															if (
																t instanceof
																h.atakmap.commoncommo.protobuf.v1
																	.Detail
															)
																return t;
															var e =
																new h.atakmap.commoncommo.protobuf.v1.Detail();
															if (
																(null != t.xmlDetail &&
																	(e.xmlDetail = String(
																		t.xmlDetail
																	)),
																null != t.contact)
															) {
																if ('object' !== typeof t.contact)
																	throw TypeError(
																		'.atakmap.commoncommo.protobuf.v1.Detail.contact: object expected'
																	);
																e.contact =
																	h.atakmap.commoncommo.protobuf.v1.Contact.fromObject(
																		t.contact
																	);
															}
															if (null != t.group) {
																if ('object' !== typeof t.group)
																	throw TypeError(
																		'.atakmap.commoncommo.protobuf.v1.Detail.group: object expected'
																	);
																e.group =
																	h.atakmap.commoncommo.protobuf.v1.Group.fromObject(
																		t.group
																	);
															}
															if (null != t.precisionLocation) {
																if (
																	'object' !==
																	typeof t.precisionLocation
																)
																	throw TypeError(
																		'.atakmap.commoncommo.protobuf.v1.Detail.precisionLocation: object expected'
																	);
																e.precisionLocation =
																	h.atakmap.commoncommo.protobuf.v1.PrecisionLocation.fromObject(
																		t.precisionLocation
																	);
															}
															if (null != t.status) {
																if ('object' !== typeof t.status)
																	throw TypeError(
																		'.atakmap.commoncommo.protobuf.v1.Detail.status: object expected'
																	);
																e.status =
																	h.atakmap.commoncommo.protobuf.v1.Status.fromObject(
																		t.status
																	);
															}
															if (null != t.takv) {
																if ('object' !== typeof t.takv)
																	throw TypeError(
																		'.atakmap.commoncommo.protobuf.v1.Detail.takv: object expected'
																	);
																e.takv =
																	h.atakmap.commoncommo.protobuf.v1.Takv.fromObject(
																		t.takv
																	);
															}
															if (null != t.track) {
																if ('object' !== typeof t.track)
																	throw TypeError(
																		'.atakmap.commoncommo.protobuf.v1.Detail.track: object expected'
																	);
																e.track =
																	h.atakmap.commoncommo.protobuf.v1.Track.fromObject(
																		t.track
																	);
															}
															return e;
														}),
														(t.toObject = function (t, e) {
															e || (e = {});
															var o = {};
															return (
																e.defaults &&
																	((o.xmlDetail = ''),
																	(o.contact = null),
																	(o.group = null),
																	(o.precisionLocation = null),
																	(o.status = null),
																	(o.takv = null),
																	(o.track = null)),
																null != t.xmlDetail &&
																	t.hasOwnProperty('xmlDetail') &&
																	(o.xmlDetail = t.xmlDetail),
																null != t.contact &&
																	t.hasOwnProperty('contact') &&
																	(o.contact =
																		h.atakmap.commoncommo.protobuf.v1.Contact.toObject(
																			t.contact,
																			e
																		)),
																null != t.group &&
																	t.hasOwnProperty('group') &&
																	(o.group =
																		h.atakmap.commoncommo.protobuf.v1.Group.toObject(
																			t.group,
																			e
																		)),
																null != t.precisionLocation &&
																	t.hasOwnProperty(
																		'precisionLocation'
																	) &&
																	(o.precisionLocation =
																		h.atakmap.commoncommo.protobuf.v1.PrecisionLocation.toObject(
																			t.precisionLocation,
																			e
																		)),
																null != t.status &&
																	t.hasOwnProperty('status') &&
																	(o.status =
																		h.atakmap.commoncommo.protobuf.v1.Status.toObject(
																			t.status,
																			e
																		)),
																null != t.takv &&
																	t.hasOwnProperty('takv') &&
																	(o.takv =
																		h.atakmap.commoncommo.protobuf.v1.Takv.toObject(
																			t.takv,
																			e
																		)),
																null != t.track &&
																	t.hasOwnProperty('track') &&
																	(o.track =
																		h.atakmap.commoncommo.protobuf.v1.Track.toObject(
																			t.track,
																			e
																		)),
																o
															);
														}),
														(t.prototype.toJSON = function () {
															return this.constructor.toObject(
																this,
																m.util.toJSONOptions
															);
														}),
														t
													);
												})()),
												(t.Group = (function () {
													function t(t) {
														if (t)
															for (
																var e = Object.keys(t), o = 0;
																o < e.length;
																++o
															)
																null != t[e[o]] &&
																	(this[e[o]] = t[e[o]]);
													}
													return (
														(t.prototype.name = ''),
														(t.prototype.role = ''),
														(t.create = function (e) {
															return new t(e);
														}),
														(t.encode = function (t, e) {
															return (
																e || (e = d.create()),
																null != t.name &&
																	Object.hasOwnProperty.call(
																		t,
																		'name'
																	) &&
																	e.uint32(10).string(t.name),
																null != t.role &&
																	Object.hasOwnProperty.call(
																		t,
																		'role'
																	) &&
																	e.uint32(18).string(t.role),
																e
															);
														}),
														(t.encodeDelimited = function (t, e) {
															return this.encode(t, e).ldelim();
														}),
														(t.decode = function (t, e) {
															t instanceof f || (t = f.create(t));
															for (
																var o =
																		void 0 === e
																			? t.len
																			: t.pos + e,
																	n =
																		new h.atakmap.commoncommo.protobuf.v1.Group();
																t.pos < o;

															) {
																var r = t.uint32();
																switch (r >>> 3) {
																	case 1:
																		n.name = t.string();
																		break;
																	case 2:
																		n.role = t.string();
																		break;
																	default:
																		t.skipType(7 & r);
																}
															}
															return n;
														}),
														(t.decodeDelimited = function (t) {
															return (
																t instanceof f || (t = new f(t)),
																this.decode(t, t.uint32())
															);
														}),
														(t.verify = function (t) {
															return 'object' !== typeof t ||
																null === t
																? 'object expected'
																: null != t.name &&
																	  t.hasOwnProperty('name') &&
																	  !v.isString(t.name)
																	? 'name: string expected'
																	: null != t.role &&
																		  t.hasOwnProperty(
																				'role'
																		  ) &&
																		  !v.isString(t.role)
																		? 'role: string expected'
																		: null;
														}),
														(t.fromObject = function (t) {
															if (
																t instanceof
																h.atakmap.commoncommo.protobuf.v1
																	.Group
															)
																return t;
															var e =
																new h.atakmap.commoncommo.protobuf.v1.Group();
															return (
																null != t.name &&
																	(e.name = String(t.name)),
																null != t.role &&
																	(e.role = String(t.role)),
																e
															);
														}),
														(t.toObject = function (t, e) {
															e || (e = {});
															var o = {};
															return (
																e.defaults &&
																	((o.name = ''), (o.role = '')),
																null != t.name &&
																	t.hasOwnProperty('name') &&
																	(o.name = t.name),
																null != t.role &&
																	t.hasOwnProperty('role') &&
																	(o.role = t.role),
																o
															);
														}),
														(t.prototype.toJSON = function () {
															return this.constructor.toObject(
																this,
																m.util.toJSONOptions
															);
														}),
														t
													);
												})()),
												(t.PrecisionLocation = (function () {
													function t(t) {
														if (t)
															for (
																var e = Object.keys(t), o = 0;
																o < e.length;
																++o
															)
																null != t[e[o]] &&
																	(this[e[o]] = t[e[o]]);
													}
													return (
														(t.prototype.geopointsrc = ''),
														(t.prototype.altsrc = ''),
														(t.create = function (e) {
															return new t(e);
														}),
														(t.encode = function (t, e) {
															return (
																e || (e = d.create()),
																null != t.geopointsrc &&
																	Object.hasOwnProperty.call(
																		t,
																		'geopointsrc'
																	) &&
																	e
																		.uint32(10)
																		.string(t.geopointsrc),
																null != t.altsrc &&
																	Object.hasOwnProperty.call(
																		t,
																		'altsrc'
																	) &&
																	e.uint32(18).string(t.altsrc),
																e
															);
														}),
														(t.encodeDelimited = function (t, e) {
															return this.encode(t, e).ldelim();
														}),
														(t.decode = function (t, e) {
															t instanceof f || (t = f.create(t));
															for (
																var o =
																		void 0 === e
																			? t.len
																			: t.pos + e,
																	n =
																		new h.atakmap.commoncommo.protobuf.v1.PrecisionLocation();
																t.pos < o;

															) {
																var r = t.uint32();
																switch (r >>> 3) {
																	case 1:
																		n.geopointsrc = t.string();
																		break;
																	case 2:
																		n.altsrc = t.string();
																		break;
																	default:
																		t.skipType(7 & r);
																}
															}
															return n;
														}),
														(t.decodeDelimited = function (t) {
															return (
																t instanceof f || (t = new f(t)),
																this.decode(t, t.uint32())
															);
														}),
														(t.verify = function (t) {
															return 'object' !== typeof t ||
																null === t
																? 'object expected'
																: null != t.geopointsrc &&
																	  t.hasOwnProperty(
																			'geopointsrc'
																	  ) &&
																	  !v.isString(t.geopointsrc)
																	? 'geopointsrc: string expected'
																	: null != t.altsrc &&
																		  t.hasOwnProperty(
																				'altsrc'
																		  ) &&
																		  !v.isString(t.altsrc)
																		? 'altsrc: string expected'
																		: null;
														}),
														(t.fromObject = function (t) {
															if (
																t instanceof
																h.atakmap.commoncommo.protobuf.v1
																	.PrecisionLocation
															)
																return t;
															var e =
																new h.atakmap.commoncommo.protobuf.v1.PrecisionLocation();
															return (
																null != t.geopointsrc &&
																	(e.geopointsrc = String(
																		t.geopointsrc
																	)),
																null != t.altsrc &&
																	(e.altsrc = String(t.altsrc)),
																e
															);
														}),
														(t.toObject = function (t, e) {
															e || (e = {});
															var o = {};
															return (
																e.defaults &&
																	((o.geopointsrc = ''),
																	(o.altsrc = '')),
																null != t.geopointsrc &&
																	t.hasOwnProperty(
																		'geopointsrc'
																	) &&
																	(o.geopointsrc = t.geopointsrc),
																null != t.altsrc &&
																	t.hasOwnProperty('altsrc') &&
																	(o.altsrc = t.altsrc),
																o
															);
														}),
														(t.prototype.toJSON = function () {
															return this.constructor.toObject(
																this,
																m.util.toJSONOptions
															);
														}),
														t
													);
												})()),
												(t.Status = (function () {
													function t(t) {
														if (t)
															for (
																var e = Object.keys(t), o = 0;
																o < e.length;
																++o
															)
																null != t[e[o]] &&
																	(this[e[o]] = t[e[o]]);
													}
													return (
														(t.prototype.battery = 0),
														(t.create = function (e) {
															return new t(e);
														}),
														(t.encode = function (t, e) {
															return (
																e || (e = d.create()),
																null != t.battery &&
																	Object.hasOwnProperty.call(
																		t,
																		'battery'
																	) &&
																	e.uint32(8).uint32(t.battery),
																e
															);
														}),
														(t.encodeDelimited = function (t, e) {
															return this.encode(t, e).ldelim();
														}),
														(t.decode = function (t, e) {
															t instanceof f || (t = f.create(t));
															for (
																var o =
																		void 0 === e
																			? t.len
																			: t.pos + e,
																	n =
																		new h.atakmap.commoncommo.protobuf.v1.Status();
																t.pos < o;

															) {
																var r = t.uint32();
																if (r >>> 3 === 1)
																	n.battery = t.uint32();
																else t.skipType(7 & r);
															}
															return n;
														}),
														(t.decodeDelimited = function (t) {
															return (
																t instanceof f || (t = new f(t)),
																this.decode(t, t.uint32())
															);
														}),
														(t.verify = function (t) {
															return 'object' !== typeof t ||
																null === t
																? 'object expected'
																: null != t.battery &&
																	  t.hasOwnProperty('battery') &&
																	  !v.isInteger(t.battery)
																	? 'battery: integer expected'
																	: null;
														}),
														(t.fromObject = function (t) {
															if (
																t instanceof
																h.atakmap.commoncommo.protobuf.v1
																	.Status
															)
																return t;
															var e =
																new h.atakmap.commoncommo.protobuf.v1.Status();
															return (
																null != t.battery &&
																	(e.battery = t.battery >>> 0),
																e
															);
														}),
														(t.toObject = function (t, e) {
															e || (e = {});
															var o = {};
															return (
																e.defaults && (o.battery = 0),
																null != t.battery &&
																	t.hasOwnProperty('battery') &&
																	(o.battery = t.battery),
																o
															);
														}),
														(t.prototype.toJSON = function () {
															return this.constructor.toObject(
																this,
																m.util.toJSONOptions
															);
														}),
														t
													);
												})()),
												(t.Takv = (function () {
													function t(t) {
														if (t)
															for (
																var e = Object.keys(t), o = 0;
																o < e.length;
																++o
															)
																null != t[e[o]] &&
																	(this[e[o]] = t[e[o]]);
													}
													return (
														(t.prototype.device = ''),
														(t.prototype.platform = ''),
														(t.prototype.os = ''),
														(t.prototype.version = ''),
														(t.create = function (e) {
															return new t(e);
														}),
														(t.encode = function (t, e) {
															return (
																e || (e = d.create()),
																null != t.device &&
																	Object.hasOwnProperty.call(
																		t,
																		'device'
																	) &&
																	e.uint32(10).string(t.device),
																null != t.platform &&
																	Object.hasOwnProperty.call(
																		t,
																		'platform'
																	) &&
																	e.uint32(18).string(t.platform),
																null != t.os &&
																	Object.hasOwnProperty.call(
																		t,
																		'os'
																	) &&
																	e.uint32(26).string(t.os),
																null != t.version &&
																	Object.hasOwnProperty.call(
																		t,
																		'version'
																	) &&
																	e.uint32(34).string(t.version),
																e
															);
														}),
														(t.encodeDelimited = function (t, e) {
															return this.encode(t, e).ldelim();
														}),
														(t.decode = function (t, e) {
															t instanceof f || (t = f.create(t));
															for (
																var o =
																		void 0 === e
																			? t.len
																			: t.pos + e,
																	n =
																		new h.atakmap.commoncommo.protobuf.v1.Takv();
																t.pos < o;

															) {
																var r = t.uint32();
																switch (r >>> 3) {
																	case 1:
																		n.device = t.string();
																		break;
																	case 2:
																		n.platform = t.string();
																		break;
																	case 3:
																		n.os = t.string();
																		break;
																	case 4:
																		n.version = t.string();
																		break;
																	default:
																		t.skipType(7 & r);
																}
															}
															return n;
														}),
														(t.decodeDelimited = function (t) {
															return (
																t instanceof f || (t = new f(t)),
																this.decode(t, t.uint32())
															);
														}),
														(t.verify = function (t) {
															return 'object' !== typeof t ||
																null === t
																? 'object expected'
																: null != t.device &&
																	  t.hasOwnProperty('device') &&
																	  !v.isString(t.device)
																	? 'device: string expected'
																	: null != t.platform &&
																		  t.hasOwnProperty(
																				'platform'
																		  ) &&
																		  !v.isString(t.platform)
																		? 'platform: string expected'
																		: null != t.os &&
																			  t.hasOwnProperty(
																					'os'
																			  ) &&
																			  !v.isString(t.os)
																			? 'os: string expected'
																			: null != t.version &&
																				  t.hasOwnProperty(
																						'version'
																				  ) &&
																				  !v.isString(
																						t.version
																				  )
																				? 'version: string expected'
																				: null;
														}),
														(t.fromObject = function (t) {
															if (
																t instanceof
																h.atakmap.commoncommo.protobuf.v1
																	.Takv
															)
																return t;
															var e =
																new h.atakmap.commoncommo.protobuf.v1.Takv();
															return (
																null != t.device &&
																	(e.device = String(t.device)),
																null != t.platform &&
																	(e.platform = String(
																		t.platform
																	)),
																null != t.os &&
																	(e.os = String(t.os)),
																null != t.version &&
																	(e.version = String(t.version)),
																e
															);
														}),
														(t.toObject = function (t, e) {
															e || (e = {});
															var o = {};
															return (
																e.defaults &&
																	((o.device = ''),
																	(o.platform = ''),
																	(o.os = ''),
																	(o.version = '')),
																null != t.device &&
																	t.hasOwnProperty('device') &&
																	(o.device = t.device),
																null != t.platform &&
																	t.hasOwnProperty('platform') &&
																	(o.platform = t.platform),
																null != t.os &&
																	t.hasOwnProperty('os') &&
																	(o.os = t.os),
																null != t.version &&
																	t.hasOwnProperty('version') &&
																	(o.version = t.version),
																o
															);
														}),
														(t.prototype.toJSON = function () {
															return this.constructor.toObject(
																this,
																m.util.toJSONOptions
															);
														}),
														t
													);
												})()),
												(t.Track = (function () {
													function t(t) {
														if (t)
															for (
																var e = Object.keys(t), o = 0;
																o < e.length;
																++o
															)
																null != t[e[o]] &&
																	(this[e[o]] = t[e[o]]);
													}
													return (
														(t.prototype.speed = 0),
														(t.prototype.course = 0),
														(t.create = function (e) {
															return new t(e);
														}),
														(t.encode = function (t, e) {
															return (
																e || (e = d.create()),
																null != t.speed &&
																	Object.hasOwnProperty.call(
																		t,
																		'speed'
																	) &&
																	e.uint32(9).double(t.speed),
																null != t.course &&
																	Object.hasOwnProperty.call(
																		t,
																		'course'
																	) &&
																	e.uint32(17).double(t.course),
																e
															);
														}),
														(t.encodeDelimited = function (t, e) {
															return this.encode(t, e).ldelim();
														}),
														(t.decode = function (t, e) {
															t instanceof f || (t = f.create(t));
															for (
																var o =
																		void 0 === e
																			? t.len
																			: t.pos + e,
																	n =
																		new h.atakmap.commoncommo.protobuf.v1.Track();
																t.pos < o;

															) {
																var r = t.uint32();
																switch (r >>> 3) {
																	case 1:
																		n.speed = t.double();
																		break;
																	case 2:
																		n.course = t.double();
																		break;
																	default:
																		t.skipType(7 & r);
																}
															}
															return n;
														}),
														(t.decodeDelimited = function (t) {
															return (
																t instanceof f || (t = new f(t)),
																this.decode(t, t.uint32())
															);
														}),
														(t.verify = function (t) {
															return 'object' !== typeof t ||
																null === t
																? 'object expected'
																: null != t.speed &&
																	  t.hasOwnProperty('speed') &&
																	  'number' !== typeof t.speed
																	? 'speed: number expected'
																	: null != t.course &&
																		  t.hasOwnProperty(
																				'course'
																		  ) &&
																		  'number' !==
																				typeof t.course
																		? 'course: number expected'
																		: null;
														}),
														(t.fromObject = function (t) {
															if (
																t instanceof
																h.atakmap.commoncommo.protobuf.v1
																	.Track
															)
																return t;
															var e =
																new h.atakmap.commoncommo.protobuf.v1.Track();
															return (
																null != t.speed &&
																	(e.speed = Number(t.speed)),
																null != t.course &&
																	(e.course = Number(t.course)),
																e
															);
														}),
														(t.toObject = function (t, e) {
															e || (e = {});
															var o = {};
															return (
																e.defaults &&
																	((o.speed = 0), (o.course = 0)),
																null != t.speed &&
																	t.hasOwnProperty('speed') &&
																	(o.speed =
																		e.json && !isFinite(t.speed)
																			? String(t.speed)
																			: t.speed),
																null != t.course &&
																	t.hasOwnProperty('course') &&
																	(o.course =
																		e.json &&
																		!isFinite(t.course)
																			? String(t.course)
																			: t.course),
																o
															);
														}),
														(t.prototype.toJSON = function () {
															return this.constructor.toObject(
																this,
																m.util.toJSONOptions
															);
														}),
														t
													);
												})()),
												(t.TakControl = (function () {
													function t(t) {
														if (t)
															for (
																var e = Object.keys(t), o = 0;
																o < e.length;
																++o
															)
																null != t[e[o]] &&
																	(this[e[o]] = t[e[o]]);
													}
													return (
														(t.prototype.minProtoVersion = 0),
														(t.prototype.maxProtoVersion = 0),
														(t.create = function (e) {
															return new t(e);
														}),
														(t.encode = function (t, e) {
															return (
																e || (e = d.create()),
																null != t.minProtoVersion &&
																	Object.hasOwnProperty.call(
																		t,
																		'minProtoVersion'
																	) &&
																	e
																		.uint32(8)
																		.uint32(t.minProtoVersion),
																null != t.maxProtoVersion &&
																	Object.hasOwnProperty.call(
																		t,
																		'maxProtoVersion'
																	) &&
																	e
																		.uint32(16)
																		.uint32(t.maxProtoVersion),
																e
															);
														}),
														(t.encodeDelimited = function (t, e) {
															return this.encode(t, e).ldelim();
														}),
														(t.decode = function (t, e) {
															t instanceof f || (t = f.create(t));
															for (
																var o =
																		void 0 === e
																			? t.len
																			: t.pos + e,
																	n =
																		new h.atakmap.commoncommo.protobuf.v1.TakControl();
																t.pos < o;

															) {
																var r = t.uint32();
																switch (r >>> 3) {
																	case 1:
																		n.minProtoVersion =
																			t.uint32();
																		break;
																	case 2:
																		n.maxProtoVersion =
																			t.uint32();
																		break;
																	default:
																		t.skipType(7 & r);
																}
															}
															return n;
														}),
														(t.decodeDelimited = function (t) {
															return (
																t instanceof f || (t = new f(t)),
																this.decode(t, t.uint32())
															);
														}),
														(t.verify = function (t) {
															return 'object' !== typeof t ||
																null === t
																? 'object expected'
																: null != t.minProtoVersion &&
																	  t.hasOwnProperty(
																			'minProtoVersion'
																	  ) &&
																	  !v.isInteger(
																			t.minProtoVersion
																	  )
																	? 'minProtoVersion: integer expected'
																	: null != t.maxProtoVersion &&
																		  t.hasOwnProperty(
																				'maxProtoVersion'
																		  ) &&
																		  !v.isInteger(
																				t.maxProtoVersion
																		  )
																		? 'maxProtoVersion: integer expected'
																		: null;
														}),
														(t.fromObject = function (t) {
															if (
																t instanceof
																h.atakmap.commoncommo.protobuf.v1
																	.TakControl
															)
																return t;
															var e =
																new h.atakmap.commoncommo.protobuf.v1.TakControl();
															return (
																null != t.minProtoVersion &&
																	(e.minProtoVersion =
																		t.minProtoVersion >>> 0),
																null != t.maxProtoVersion &&
																	(e.maxProtoVersion =
																		t.maxProtoVersion >>> 0),
																e
															);
														}),
														(t.toObject = function (t, e) {
															e || (e = {});
															var o = {};
															return (
																e.defaults &&
																	((o.minProtoVersion = 0),
																	(o.maxProtoVersion = 0)),
																null != t.minProtoVersion &&
																	t.hasOwnProperty(
																		'minProtoVersion'
																	) &&
																	(o.minProtoVersion =
																		t.minProtoVersion),
																null != t.maxProtoVersion &&
																	t.hasOwnProperty(
																		'maxProtoVersion'
																	) &&
																	(o.maxProtoVersion =
																		t.maxProtoVersion),
																o
															);
														}),
														(t.prototype.toJSON = function () {
															return this.constructor.toObject(
																this,
																m.util.toJSONOptions
															);
														}),
														t
													);
												})()),
												(t.TakMessage = (function () {
													function t(t) {
														if (t)
															for (
																var e = Object.keys(t), o = 0;
																o < e.length;
																++o
															)
																null != t[e[o]] &&
																	(this[e[o]] = t[e[o]]);
													}
													return (
														(t.prototype.takControl = null),
														(t.prototype.cotEvent = null),
														(t.create = function (e) {
															return new t(e);
														}),
														(t.encode = function (t, e) {
															return (
																e || (e = d.create()),
																null != t.takControl &&
																	Object.hasOwnProperty.call(
																		t,
																		'takControl'
																	) &&
																	h.atakmap.commoncommo.protobuf.v1.TakControl.encode(
																		t.takControl,
																		e.uint32(10).fork()
																	).ldelim(),
																null != t.cotEvent &&
																	Object.hasOwnProperty.call(
																		t,
																		'cotEvent'
																	) &&
																	h.atakmap.commoncommo.protobuf.v1.CotEvent.encode(
																		t.cotEvent,
																		e.uint32(18).fork()
																	).ldelim(),
																e
															);
														}),
														(t.encodeDelimited = function (t, e) {
															return this.encode(t, e).ldelim();
														}),
														(t.decode = function (t, e) {
															t instanceof f || (t = f.create(t));
															for (
																var o =
																		void 0 === e
																			? t.len
																			: t.pos + e,
																	n =
																		new h.atakmap.commoncommo.protobuf.v1.TakMessage();
																t.pos < o;

															) {
																var r = t.uint32();
																switch (r >>> 3) {
																	case 1:
																		n.takControl =
																			h.atakmap.commoncommo.protobuf.v1.TakControl.decode(
																				t,
																				t.uint32()
																			);
																		break;
																	case 2:
																		n.cotEvent =
																			h.atakmap.commoncommo.protobuf.v1.CotEvent.decode(
																				t,
																				t.uint32()
																			);
																		break;
																	default:
																		t.skipType(7 & r);
																}
															}
															return n;
														}),
														(t.decodeDelimited = function (t) {
															return (
																t instanceof f || (t = new f(t)),
																this.decode(t, t.uint32())
															);
														}),
														(t.verify = function (t) {
															if ('object' !== typeof t || null === t)
																return 'object expected';
															if (
																null != t.takControl &&
																t.hasOwnProperty('takControl')
															) {
																var e =
																	h.atakmap.commoncommo.protobuf.v1.TakControl.verify(
																		t.takControl
																	);
																if (e) return 'takControl.' + e;
															}
															if (
																null != t.cotEvent &&
																t.hasOwnProperty('cotEvent')
															) {
																var o =
																	h.atakmap.commoncommo.protobuf.v1.CotEvent.verify(
																		t.cotEvent
																	);
																if (o) return 'cotEvent.' + o;
															}
															return null;
														}),
														(t.fromObject = function (t) {
															if (
																t instanceof
																h.atakmap.commoncommo.protobuf.v1
																	.TakMessage
															)
																return t;
															var e =
																new h.atakmap.commoncommo.protobuf.v1.TakMessage();
															if (null != t.takControl) {
																if (
																	'object' !== typeof t.takControl
																)
																	throw TypeError(
																		'.atakmap.commoncommo.protobuf.v1.TakMessage.takControl: object expected'
																	);
																e.takControl =
																	h.atakmap.commoncommo.protobuf.v1.TakControl.fromObject(
																		t.takControl
																	);
															}
															if (null != t.cotEvent) {
																if ('object' !== typeof t.cotEvent)
																	throw TypeError(
																		'.atakmap.commoncommo.protobuf.v1.TakMessage.cotEvent: object expected'
																	);
																e.cotEvent =
																	h.atakmap.commoncommo.protobuf.v1.CotEvent.fromObject(
																		t.cotEvent
																	);
															}
															return e;
														}),
														(t.toObject = function (t, e) {
															e || (e = {});
															var o = {};
															return (
																e.defaults &&
																	((o.takControl = null),
																	(o.cotEvent = null)),
																null != t.takControl &&
																	t.hasOwnProperty(
																		'takControl'
																	) &&
																	(o.takControl =
																		h.atakmap.commoncommo.protobuf.v1.TakControl.toObject(
																			t.takControl,
																			e
																		)),
																null != t.cotEvent &&
																	t.hasOwnProperty('cotEvent') &&
																	(o.cotEvent =
																		h.atakmap.commoncommo.protobuf.v1.CotEvent.toObject(
																			t.cotEvent,
																			e
																		)),
																o
															);
														}),
														(t.prototype.toJSON = function () {
															return this.constructor.toObject(
																this,
																m.util.toJSONOptions
															);
														}),
														t
													);
												})()),
												t
											);
										})()),
										t
									);
								})()),
								t
							);
						})()),
						t
					);
				})();
				function y(t, e) {
					var o = Object.keys(t);
					if (Object.getOwnPropertySymbols) {
						var n = Object.getOwnPropertySymbols(t);
						(e &&
							(n = n.filter(function (e) {
								return Object.getOwnPropertyDescriptor(t, e).enumerable;
							})),
							o.push.apply(o, n));
					}
					return o;
				}
				function b(t) {
					for (var e = 1; e < arguments.length; e++) {
						var o = null != arguments[e] ? arguments[e] : {};
						e % 2
							? y(Object(o), !0).forEach(function (e) {
									r(t, e, o[e]);
								})
							: Object.getOwnPropertyDescriptors
								? Object.defineProperties(t, Object.getOwnPropertyDescriptors(o))
								: y(Object(o)).forEach(function (e) {
										Object.defineProperty(
											t,
											e,
											Object.getOwnPropertyDescriptor(o, e)
										);
									});
					}
					return t;
				}
				var g,
					O = o(9550),
					w = h.atakmap.commoncommo.protobuf.v1,
					k = { enums: String, longs: Number, defaults: !0, arrays: !0, objects: !0 };
				function T(t) {
					var e = new Uint8Array(t);
					if (e.byteLength < 2) throw new Error('Cannot parse empty message');
					if (191 !== e[0]) throw new Error('Invalid message header.');
					var o = w.TakMessage.toObject(w.TakMessage.decodeDelimited(e.slice(1)), k),
						n = o;
					return o.cotEvent
						? (o.cotEvent.detail
								? (o.cotEvent.detail.xmlDetail
										? (n.cotEvent.detail.xml = (0, O.fromXML)(
												n.cotEvent.detail.xmlDetail,
												!0
											))
										: (n.cotEvent.detail.xml = null),
									(n.cotEvent.detail.xmlDetail = null))
								: (n.cotEvent.detail = null),
							n)
						: null;
				}
				!(function (t) {
					((t[(t.DISCONNECTED = 0)] = 'DISCONNECTED'),
						(t[(t.DISCONNECTING = 1)] = 'DISCONNECTING'),
						(t[(t.CONNECTED = 2)] = 'CONNECTED'),
						(t[(t.CONNECTING = 3)] = 'CONNECTING'));
				})(g || (g = {}));
				h.atakmap.commoncommo.protobuf.v1;
				var P,
					j,
					S,
					E,
					x,
					C,
					D = /^(https?)/,
					N = /^(https)/,
					L = (function (t) {
						!(function (t, e) {
							if ('function' !== typeof e && null !== e)
								throw new TypeError(
									'Super expression must either be null or a function'
								);
							((t.prototype = Object.create(e && e.prototype, {
								constructor: { value: t, writable: !0, configurable: !0 }
							})),
								Object.defineProperty(t, 'prototype', { writable: !1 }),
								e && c(t, e));
						})(s, t);
						var e,
							o,
							n,
							r = p(s);
						function s() {
							var t;
							i(this, s);
							for (var e = arguments.length, o = new Array(e), n = 0; n < e; n++)
								o[n] = arguments[n];
							return (
								((t = r.call.apply(r, [this].concat(o))).pendingItems = []),
								(t.state = g.DISCONNECTED),
								(t.ws = null),
								(t.socketUrl = void 0),
								(t.onMessage = function (e) {
									var o = e.data;
									if (o instanceof ArrayBuffer) {
										var n = T(o);
										n && n.cotEvent && t.emit('message', n.cotEvent);
									} else
										t.onError(
											new Error(
												'SocketConnection.onMessage Received invalid message data (non-ArrayBuffer).'
											)
										);
								}),
								(t.onError = function (e, o) {
									(t.isConnected() && t.disconnect(), t.emit('error', e, o));
								}),
								t
							);
						}
						return (
							(e = s),
							(o = [
								{
									key: 'reconnect',
									value: function (t) {
										var e = this;
										((this.socketUrl = t),
											this.isConnected()
												? (this.once('disconnect', function () {
														e.canConnect() && e.connect();
													}),
													this.disconnect())
												: this.connect());
									}
								},
								{
									key: 'disconnect',
									value: function () {
										(this.isState(g.CONNECTED) || this.isState(g.CONNECTING)) &&
											((this.state = g.DISCONNECTING),
											this.ws && (this.ws.close(), (this.ws = null)),
											this.emit('disconnect'),
											(this.state = g.DISCONNECTED));
									}
								},
								{
									key: 'sendMessage',
									value: function (t) {
										this.ws && this.isConnected()
											? this.ws.send(
													(function (t) {
														var e = w.TakMessage.verify(t);
														if (null !== e)
															throw new Error(
																'Invalid TakMessage provided: '.concat(
																	e
																)
															);
														var o = b({}, t);
														t.cotEvent
															? ((t.cotEvent = b({}, t.cotEvent)),
																t.cotEvent.detail
																	? ((t.cotEvent.detail = b(
																			{},
																			t.cotEvent.detail
																		)),
																		t.cotEvent.detail.xml
																			? (o.cotEvent.detail.xmlDetail =
																					(0, O.toXML)(
																						o.cotEvent
																							.detail
																							.xml,
																						!1
																					))
																			: ((o.cotEvent.detail.xmlDetail =
																					null),
																				delete o.cotEvent
																					.detail
																					.xmlDetail),
																		(o.cotEvent.detail.xml =
																			null),
																		delete o.cotEvent.detail
																			.xml)
																	: ((o.cotEvent.detail = null),
																		delete o.cotEvent.detail))
															: ((o.cotEvent = null),
																delete o.cotEvent);
														var n =
																w.TakMessage.encodeDelimited(
																	o
																).finish(),
															r = new Uint8Array(n.length + 1);
														return (r.set([191]), r.set(n, 1), r);
													})({ cotEvent: t, takControl: null })
												)
											: this.pendingItems.push(t);
									}
								},
								{
									key: 'getState',
									value: function () {
										return this.state;
									}
								},
								{
									key: 'isConnected',
									value: function () {
										return this.isState(g.CONNECTED);
									}
								},
								{
									key: 'isDisconnected',
									value: function () {
										return this.isState(g.DISCONNECTED);
									}
								},
								{
									key: 'setSocketUrl',
									value: function (t) {
										var e = this;
										((this.socketUrl = t),
											this.disconnect(),
											this.once('disconnect', function () {
												e.reconnect(t);
											}));
									}
								},
								{
									key: 'canConnect',
									value: function () {
										return this.isDisconnected();
									}
								},
								{
									key: 'isState',
									value: function (t) {
										return this.state === t;
									}
								},
								{
									key: 'connect',
									value: function () {
										var t = this;
										if (this.isState(g.DISCONNECTED)) {
											if (((this.state = g.CONNECTING), !this.socketUrl))
												throw new Error(
													'SocketService.connect: attempting to connect without a valid socket url.'
												);
											var e = this.socketUrl;
											if (D.test(e)) {
												var o =
													'https' === location.protocol || N.test(e)
														? 'wss'
														: 'ws';
												e = e.replace(D, o);
											}
											((this.ws = new WebSocket(e)),
												(this.ws.binaryType = 'arraybuffer'),
												this.ws.addEventListener('open', function () {
													t.isState(g.CONNECTING)
														? ((t.state = g.CONNECTED),
															t.emit('connect'),
															t.flushQueue())
														: t.disconnect();
												}),
												this.ws.addEventListener('close', function (o) {
													((t.state = g.DISCONNECTED),
														t.onError(
															new Error(
																'SocketConnection Socket on '
																	.concat(e, ' closed. Reason: ')
																	.concat(
																		o.reason,
																		'., Status code: '
																	)
																	.concat(o.code)
															),
															o.code
														));
												}),
												this.ws.addEventListener(
													'message',
													this.onMessage
												));
										}
									}
								},
								{
									key: 'flushQueue',
									value: function () {
										var t = this;
										(this.pendingItems.forEach(function (e) {
											try {
												t.sendMessage(e);
											} catch (o) {}
										}),
											(this.pendingItems = []));
									}
								}
							]) && a(e.prototype, o),
							n && a(e, n),
							Object.defineProperty(e, 'prototype', { writable: !1 }),
							s
						);
					})(O.EventEmitter);
				function I() {
					I = function () {
						return t;
					};
					var t = {},
						e = Object.prototype,
						o = e.hasOwnProperty,
						n = 'function' == typeof Symbol ? Symbol : {},
						r = n.iterator || '@@iterator',
						i = n.asyncIterator || '@@asyncIterator',
						a = n.toStringTag || '@@toStringTag';
					function c(t, e, o) {
						return (
							Object.defineProperty(t, e, {
								value: o,
								enumerable: !0,
								configurable: !0,
								writable: !0
							}),
							t[e]
						);
					}
					try {
						c({}, '');
					} catch (S) {
						c = function (t, e, o) {
							return (t[e] = o);
						};
					}
					function s(t, e, o, n) {
						var r = e && e.prototype instanceof p ? e : p,
							i = Object.create(r.prototype),
							a = new T(n || []);
						return (
							(i._invoke = (function (t, e, o) {
								var n = 'suspendedStart';
								return function (r, i) {
									if ('executing' === n)
										throw new Error('Generator is already running');
									if ('completed' === n) {
										if ('throw' === r) throw i;
										return j();
									}
									for (o.method = r, o.arg = i; ; ) {
										var a = o.delegate;
										if (a) {
											var c = O(a, o);
											if (c) {
												if (c === u) continue;
												return c;
											}
										}
										if ('next' === o.method) o.sent = o._sent = o.arg;
										else if ('throw' === o.method) {
											if ('suspendedStart' === n)
												throw ((n = 'completed'), o.arg);
											o.dispatchException(o.arg);
										} else 'return' === o.method && o.abrupt('return', o.arg);
										n = 'executing';
										var s = l(t, e, o);
										if ('normal' === s.type) {
											if (
												((n = o.done ? 'completed' : 'suspendedYield'),
												s.arg === u)
											)
												continue;
											return { value: s.arg, done: o.done };
										}
										'throw' === s.type &&
											((n = 'completed'),
											(o.method = 'throw'),
											(o.arg = s.arg));
									}
								};
							})(t, o, a)),
							i
						);
					}
					function l(t, e, o) {
						try {
							return { type: 'normal', arg: t.call(e, o) };
						} catch (S) {
							return { type: 'throw', arg: S };
						}
					}
					t.wrap = s;
					var u = {};
					function p() {}
					function m() {}
					function f() {}
					var d = {};
					c(d, r, function () {
						return this;
					});
					var v = Object.getPrototypeOf,
						h = v && v(v(P([])));
					h && h !== e && o.call(h, r) && (d = h);
					var y = (f.prototype = p.prototype = Object.create(d));
					function b(t) {
						['next', 'throw', 'return'].forEach(function (e) {
							c(t, e, function (t) {
								return this._invoke(e, t);
							});
						});
					}
					function g(t, e) {
						function n(r, i, a, c) {
							var s = l(t[r], t, i);
							if ('throw' !== s.type) {
								var u = s.arg,
									p = u.value;
								return p && 'object' == typeof p && o.call(p, '__await')
									? e.resolve(p.__await).then(
											function (t) {
												n('next', t, a, c);
											},
											function (t) {
												n('throw', t, a, c);
											}
										)
									: e.resolve(p).then(
											function (t) {
												((u.value = t), a(u));
											},
											function (t) {
												return n('throw', t, a, c);
											}
										);
							}
							c(s.arg);
						}
						var r;
						this._invoke = function (t, o) {
							function i() {
								return new e(function (e, r) {
									n(t, o, e, r);
								});
							}
							return (r = r ? r.then(i, i) : i());
						};
					}
					function O(t, e) {
						var o = t.iterator[e.method];
						if (void 0 === o) {
							if (((e.delegate = null), 'throw' === e.method)) {
								if (
									t.iterator.return &&
									((e.method = 'return'),
									(e.arg = void 0),
									O(t, e),
									'throw' === e.method)
								)
									return u;
								((e.method = 'throw'),
									(e.arg = new TypeError(
										"The iterator does not provide a 'throw' method"
									)));
							}
							return u;
						}
						var n = l(o, t.iterator, e.arg);
						if ('throw' === n.type)
							return ((e.method = 'throw'), (e.arg = n.arg), (e.delegate = null), u);
						var r = n.arg;
						return r
							? r.done
								? ((e[t.resultName] = r.value),
									(e.next = t.nextLoc),
									'return' !== e.method &&
										((e.method = 'next'), (e.arg = void 0)),
									(e.delegate = null),
									u)
								: r
							: ((e.method = 'throw'),
								(e.arg = new TypeError('iterator result is not an object')),
								(e.delegate = null),
								u);
					}
					function w(t) {
						var e = { tryLoc: t[0] };
						(1 in t && (e.catchLoc = t[1]),
							2 in t && ((e.finallyLoc = t[2]), (e.afterLoc = t[3])),
							this.tryEntries.push(e));
					}
					function k(t) {
						var e = t.completion || {};
						((e.type = 'normal'), delete e.arg, (t.completion = e));
					}
					function T(t) {
						((this.tryEntries = [{ tryLoc: 'root' }]),
							t.forEach(w, this),
							this.reset(!0));
					}
					function P(t) {
						if (t) {
							var e = t[r];
							if (e) return e.call(t);
							if ('function' == typeof t.next) return t;
							if (!isNaN(t.length)) {
								var n = -1,
									i = function e() {
										for (; ++n < t.length; )
											if (o.call(t, n))
												return ((e.value = t[n]), (e.done = !1), e);
										return ((e.value = void 0), (e.done = !0), e);
									};
								return (i.next = i);
							}
						}
						return { next: j };
					}
					function j() {
						return { value: void 0, done: !0 };
					}
					return (
						(m.prototype = f),
						c(y, 'constructor', f),
						c(f, 'constructor', m),
						(m.displayName = c(f, a, 'GeneratorFunction')),
						(t.isGeneratorFunction = function (t) {
							var e = 'function' == typeof t && t.constructor;
							return (
								!!e &&
								(e === m || 'GeneratorFunction' === (e.displayName || e.name))
							);
						}),
						(t.mark = function (t) {
							return (
								Object.setPrototypeOf
									? Object.setPrototypeOf(t, f)
									: ((t.__proto__ = f), c(t, a, 'GeneratorFunction')),
								(t.prototype = Object.create(y)),
								t
							);
						}),
						(t.awrap = function (t) {
							return { __await: t };
						}),
						b(g.prototype),
						c(g.prototype, i, function () {
							return this;
						}),
						(t.AsyncIterator = g),
						(t.async = function (e, o, n, r, i) {
							void 0 === i && (i = Promise);
							var a = new g(s(e, o, n, r), i);
							return t.isGeneratorFunction(o)
								? a
								: a.next().then(function (t) {
										return t.done ? t.value : a.next();
									});
						}),
						b(y),
						c(y, a, 'Generator'),
						c(y, r, function () {
							return this;
						}),
						c(y, 'toString', function () {
							return '[object Generator]';
						}),
						(t.keys = function (t) {
							var e = [];
							for (var o in t) e.push(o);
							return (
								e.reverse(),
								function o() {
									for (; e.length; ) {
										var n = e.pop();
										if (n in t) return ((o.value = n), (o.done = !1), o);
									}
									return ((o.done = !0), o);
								}
							);
						}),
						(t.values = P),
						(T.prototype = {
							constructor: T,
							reset: function (t) {
								if (
									((this.prev = 0),
									(this.next = 0),
									(this.sent = this._sent = void 0),
									(this.done = !1),
									(this.delegate = null),
									(this.method = 'next'),
									(this.arg = void 0),
									this.tryEntries.forEach(k),
									!t)
								)
									for (var e in this)
										't' === e.charAt(0) &&
											o.call(this, e) &&
											!isNaN(+e.slice(1)) &&
											(this[e] = void 0);
							},
							stop: function () {
								this.done = !0;
								var t = this.tryEntries[0].completion;
								if ('throw' === t.type) throw t.arg;
								return this.rval;
							},
							dispatchException: function (t) {
								if (this.done) throw t;
								var e = this;
								function n(o, n) {
									return (
										(a.type = 'throw'),
										(a.arg = t),
										(e.next = o),
										n && ((e.method = 'next'), (e.arg = void 0)),
										!!n
									);
								}
								for (var r = this.tryEntries.length - 1; r >= 0; --r) {
									var i = this.tryEntries[r],
										a = i.completion;
									if ('root' === i.tryLoc) return n('end');
									if (i.tryLoc <= this.prev) {
										var c = o.call(i, 'catchLoc'),
											s = o.call(i, 'finallyLoc');
										if (c && s) {
											if (this.prev < i.catchLoc) return n(i.catchLoc, !0);
											if (this.prev < i.finallyLoc) return n(i.finallyLoc);
										} else if (c) {
											if (this.prev < i.catchLoc) return n(i.catchLoc, !0);
										} else {
											if (!s)
												throw new Error(
													'try statement without catch or finally'
												);
											if (this.prev < i.finallyLoc) return n(i.finallyLoc);
										}
									}
								}
							},
							abrupt: function (t, e) {
								for (var n = this.tryEntries.length - 1; n >= 0; --n) {
									var r = this.tryEntries[n];
									if (
										r.tryLoc <= this.prev &&
										o.call(r, 'finallyLoc') &&
										this.prev < r.finallyLoc
									) {
										var i = r;
										break;
									}
								}
								i &&
									('break' === t || 'continue' === t) &&
									i.tryLoc <= e &&
									e <= i.finallyLoc &&
									(i = null);
								var a = i ? i.completion : {};
								return (
									(a.type = t),
									(a.arg = e),
									i
										? ((this.method = 'next'), (this.next = i.finallyLoc), u)
										: this.complete(a)
								);
							},
							complete: function (t, e) {
								if ('throw' === t.type) throw t.arg;
								return (
									'break' === t.type || 'continue' === t.type
										? (this.next = t.arg)
										: 'return' === t.type
											? ((this.rval = this.arg = t.arg),
												(this.method = 'return'),
												(this.next = 'end'))
											: 'normal' === t.type && e && (this.next = e),
									u
								);
							},
							finish: function (t) {
								for (var e = this.tryEntries.length - 1; e >= 0; --e) {
									var o = this.tryEntries[e];
									if (o.finallyLoc === t)
										return (this.complete(o.completion, o.afterLoc), k(o), u);
								}
							},
							catch: function (t) {
								for (var e = this.tryEntries.length - 1; e >= 0; --e) {
									var o = this.tryEntries[e];
									if (o.tryLoc === t) {
										var n = o.completion;
										if ('throw' === n.type) {
											var r = n.arg;
											k(o);
										}
										return r;
									}
								}
								throw new Error('illegal catch attempt');
							},
							delegateYield: function (t, e, o) {
								return (
									(this.delegate = { iterator: P(t), resultName: e, nextLoc: o }),
									'next' === this.method && (this.arg = void 0),
									u
								);
							}
						}),
						t
					);
				}
				((L.MAX_NO_DATA_RECEIVED_INTERVAL = 3e4),
					(L.CHECK_SOCKET_ACTIVITY_INTERVAL = 15e3),
					(L.CONNECTION_CHECK_INTERVAL = 5e3),
					(L.MAX_ERROR_COUNT = 20),
					(function (t) {
						((t[(t.GetAllEvents = 0)] = 'GetAllEvents'),
							(t[(t.RemoveEvents = 1)] = 'RemoveEvents'),
							(t[(t.SaveEvents = 2)] = 'SaveEvents'));
					})(P || (P = {})),
					(function (t) {
						((t[(t.Connect = 0)] = 'Connect'),
							(t[(t.Disconnect = 1)] = 'Disconnect'),
							(t[(t.SetSocketUrl = 2)] = 'SetSocketUrl'),
							(t[(t.OnSocketConnect = 3)] = 'OnSocketConnect'),
							(t[(t.OnSocketDisconnect = 4)] = 'OnSocketDisconnect'),
							(t[(t.OnSocketError = 5)] = 'OnSocketError'),
							(t[(t.OnSocketMessage = 6)] = 'OnSocketMessage'),
							(t[(t.SendMessage = 7)] = 'SendMessage'));
					})(j || (j = {})),
					(function (t) {
						((t[(t.DeleteMessages = 0)] = 'DeleteMessages'),
							(t[(t.GetAllMessages = 1)] = 'GetAllMessages'),
							(t[(t.SaveMessages = 2)] = 'SaveMessages'));
					})(S || (S = {})),
					(function (t) {
						((t[(t.UnzipFile = 0)] = 'UnzipFile'),
							(t[(t.GetAllDataPackages = 1)] = 'GetAllDataPackages'),
							(t[(t.ProcessNewDataPackage = 2)] = 'ProcessNewDataPackage'),
							(t[(t.ToggleDataPackageEnabled = 3)] = 'ToggleDataPackageEnabled'),
							(t[(t.UpdateDataPackage = 4)] = 'UpdateDataPackage'),
							(t[(t.DeleteDataPackage = 5)] = 'DeleteDataPackage'));
					})(E || (E = {})),
					(function (t) {
						((t[(t.GetWkt = 0)] = 'GetWkt'),
							(t[(t.LoadTiff = 1)] = 'LoadTiff'),
							(t[(t.LoadItems = 2)] = 'LoadItems'));
					})(x || (x = {})),
					(function (t) {
						((t[(t.AddFile = 0)] = 'AddFile'),
							(t[(t.GetAllFiles = 1)] = 'GetAllFiles'),
							(t[(t.GetFile = 2)] = 'GetFile'),
							(t[(t.RemoveFile = 3)] = 'RemoveFile'),
							(t[(t.UpdateFile = 4)] = 'UpdateFile'));
					})(C || (C = {})));
				var V = new L();
				function _(t) {
					var e = t;
					V.reconnect(e);
				}
				function G() {
					V.disconnect();
				}
				function M(t) {
					var e = t;
					V.setSocketUrl(e);
				}
				function F(t) {
					var e = t;
					V.sendMessage(e);
				}
				((onmessage = function (t) {
					var e,
						o = t.data,
						n = o.mode,
						i = o.payload,
						a = (r((e = {}), j.Connect, _),
						r(e, j.Disconnect, G),
						r(e, j.SetSocketUrl, M),
						r(e, j.SendMessage, F),
						e)[n];
					a && a(i);
				}),
					V.on('connect', function () {
						var t = V.getState(),
							e = { mode: j.OnSocketConnect, payload: t };
						postMessage(e);
					}),
					V.on('disconnect', function () {
						var t = V.getState(),
							e = { mode: j.OnSocketDisconnect, payload: t };
						postMessage(e);
					}),
					V.on('message', function (t) {
						var e = V.getState(),
							o = { mode: j.OnSocketMessage, payload: { state: e, message: t } };
						postMessage(o);
					}),
					V.on(
						'error',
						(function () {
							var t,
								e =
									((t = I().mark(function t(e, o) {
										var n, r;
										return I().wrap(function (t) {
											for (;;)
												switch ((t.prev = t.next)) {
													case 0:
														((n = V.getState()),
															(r = {
																mode: j.OnSocketError,
																payload: {
																	state: n,
																	error: e,
																	closeEventCode: o
																}
															}),
															postMessage(r));
													case 3:
													case 'end':
														return t.stop();
												}
										}, t);
									})),
									function () {
										var e = this,
											o = arguments;
										return new Promise(function (r, i) {
											var a = t.apply(e, o);
											function c(t) {
												n(a, r, i, c, s, 'next', t);
											}
											function s(t) {
												n(a, r, i, c, s, 'throw', t);
											}
											c(void 0);
										});
									});
							return function (t, o) {
								return e.apply(this, arguments);
							};
						})()
					));
			}
		},
		e = {};
	function o(n) {
		var r = e[n];
		if (void 0 !== r) return r.exports;
		var i = (e[n] = { exports: {} });
		return (t[n].call(i.exports, i, i.exports, o), i.exports);
	}
	((o.m = t),
		(o.x = function () {
			var t = o.O(void 0, [138, 550], function () {
				return o(2266);
			});
			return (t = o.O(t));
		}),
		(function () {
			var t = [];
			o.O = function (e, n, r, i) {
				if (!n) {
					var a = 1 / 0;
					for (u = 0; u < t.length; u++) {
						((n = t[u][0]), (r = t[u][1]), (i = t[u][2]));
						for (var c = !0, s = 0; s < n.length; s++)
							(!1 & i || a >= i) &&
							Object.keys(o.O).every(function (t) {
								return o.O[t](n[s]);
							})
								? n.splice(s--, 1)
								: ((c = !1), i < a && (a = i));
						if (c) {
							t.splice(u--, 1);
							var l = r();
							void 0 !== l && (e = l);
						}
					}
					return e;
				}
				i = i || 0;
				for (var u = t.length; u > 0 && t[u - 1][2] > i; u--) t[u] = t[u - 1];
				t[u] = [n, r, i];
			};
		})(),
		(o.f = {}),
		(o.e = function (t) {
			return Promise.all(
				Object.keys(o.f).reduce(function (e, n) {
					return (o.f[n](t, e), e);
				}, [])
			);
		}),
		(o.u = function (t) {
			return 'static/js/' + t + '.' + { 138: '6ad5e274', 550: '9c0f43c2' }[t] + '.chunk.js';
		}),
		(o.miniCssF = function (t) {}),
		(o.g = (function () {
			if ('object' === typeof globalThis) return globalThis;
			try {
				return this || new Function('return this')();
			} catch (t) {
				if ('object' === typeof window) return window;
			}
		})()),
		(o.o = function (t, e) {
			return Object.prototype.hasOwnProperty.call(t, e);
		}),
		(function () {
			var t;
			o.g.importScripts && (t = o.g.location + '');
			var e = o.g.document;
			if (!t && e && (e.currentScript && (t = e.currentScript.src), !t)) {
				var n = e.getElementsByTagName('script');
				n.length && (t = n[n.length - 1].src);
			}
			if (!t) throw new Error('Automatic publicPath is not supported in this browser');
			((t = t
				.replace(/#.*$/, '')
				.replace(/\?.*$/, '')
				.replace(/\/[^\/]+$/, '/')),
				(o.p = t + '../../'));
		})(),
		(function () {
			var t = { 266: 1 };
			o.f.i = function (e, n) {
				t[e] || importScripts(o.p + o.u(e));
			};
			var e = (Object(
					'undefined' !== typeof self
						? self
						: 'undefined' !== typeof window
							? window
							: 'undefined' !== typeof global
								? global
								: Function('return this')()
				).webpackChunk_webtak_core =
					Object(
						'undefined' !== typeof self
							? self
							: 'undefined' !== typeof window
								? window
								: 'undefined' !== typeof global
									? global
									: Function('return this')()
					).webpackChunk_webtak_core || []),
				n = e.push.bind(e);
			e.push = function (e) {
				var r = e[0],
					i = e[1],
					a = e[2];
				for (var c in i) o.o(i, c) && (o.m[c] = i[c]);
				for (a && a(o); r.length; ) t[r.pop()] = 1;
				n(e);
			};
		})(),
		(function () {
			var t = o.x;
			o.x = function () {
				return Promise.all([o.e(138), o.e(550)]).then(t);
			};
		})());
	o.x();
})();
