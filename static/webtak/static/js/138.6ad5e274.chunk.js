(Object(
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
	).webpackChunk_webtak_core || []).push([
	[138],
	{
		5270: function (t) {
			((t.exports = function (t, e) {
				(null == e || e > t.length) && (e = t.length);
				for (var r = 0, n = new Array(e); r < e; r++) n[r] = t[r];
				return n;
			}),
				(t.exports.__esModule = !0),
				(t.exports.default = t.exports));
		},
		4180: function (t) {
			((t.exports = function (t) {
				if (Array.isArray(t)) return t;
			}),
				(t.exports.__esModule = !0),
				(t.exports.default = t.exports));
		},
		1232: function (t, e, r) {
			var n = r(5270);
			((t.exports = function (t) {
				if (Array.isArray(t)) return n(t);
			}),
				(t.exports.__esModule = !0),
				(t.exports.default = t.exports));
		},
		8111: function (t) {
			((t.exports = function (t) {
				if (void 0 === t)
					throw new ReferenceError(
						"this hasn't been initialised - super() hasn't been called"
					);
				return t;
			}),
				(t.exports.__esModule = !0),
				(t.exports.default = t.exports));
		},
		2954: function (t) {
			function e(t, e, r, n, o, i, s) {
				try {
					var u = t[i](s),
						f = u.value;
				} catch (l) {
					return void r(l);
				}
				u.done ? e(f) : Promise.resolve(f).then(n, o);
			}
			((t.exports = function (t) {
				return function () {
					var r = this,
						n = arguments;
					return new Promise(function (o, i) {
						var s = t.apply(r, n);
						function u(t) {
							e(s, o, i, u, f, 'next', t);
						}
						function f(t) {
							e(s, o, i, u, f, 'throw', t);
						}
						u(void 0);
					});
				};
			}),
				(t.exports.__esModule = !0),
				(t.exports.default = t.exports));
		},
		85: function (t) {
			((t.exports = function (t, e) {
				if (!(t instanceof e)) throw new TypeError('Cannot call a class as a function');
			}),
				(t.exports.__esModule = !0),
				(t.exports.default = t.exports));
		},
		5198: function (t) {
			function e(t, e) {
				for (var r = 0; r < e.length; r++) {
					var n = e[r];
					((n.enumerable = n.enumerable || !1),
						(n.configurable = !0),
						'value' in n && (n.writable = !0),
						Object.defineProperty(t, n.key, n));
				}
			}
			((t.exports = function (t, r, n) {
				return (
					r && e(t.prototype, r),
					n && e(t, n),
					Object.defineProperty(t, 'prototype', { writable: !1 }),
					t
				);
			}),
				(t.exports.__esModule = !0),
				(t.exports.default = t.exports));
		},
		4564: function (t, e, r) {
			var n = r(2588),
				o = r(1549),
				i = r(6983);
			((t.exports = function (t) {
				var e = o();
				return function () {
					var r,
						o = n(t);
					if (e) {
						var s = n(this).constructor;
						r = Reflect.construct(o, arguments, s);
					} else r = o.apply(this, arguments);
					return i(this, r);
				};
			}),
				(t.exports.__esModule = !0),
				(t.exports.default = t.exports));
		},
		1260: function (t) {
			((t.exports = function (t, e, r) {
				return (
					e in t
						? Object.defineProperty(t, e, {
								value: r,
								enumerable: !0,
								configurable: !0,
								writable: !0
							})
						: (t[e] = r),
					t
				);
			}),
				(t.exports.__esModule = !0),
				(t.exports.default = t.exports));
		},
		2588: function (t) {
			function e(r) {
				return (
					(t.exports = e =
						Object.setPrototypeOf
							? Object.getPrototypeOf
							: function (t) {
									return t.__proto__ || Object.getPrototypeOf(t);
								}),
					(t.exports.__esModule = !0),
					(t.exports.default = t.exports),
					e(r)
				);
			}
			((t.exports = e), (t.exports.__esModule = !0), (t.exports.default = t.exports));
		},
		270: function (t, e, r) {
			var n = r(742);
			((t.exports = function (t, e) {
				if ('function' !== typeof e && null !== e)
					throw new TypeError('Super expression must either be null or a function');
				((t.prototype = Object.create(e && e.prototype, {
					constructor: { value: t, writable: !0, configurable: !0 }
				})),
					Object.defineProperty(t, 'prototype', { writable: !1 }),
					e && n(t, e));
			}),
				(t.exports.__esModule = !0),
				(t.exports.default = t.exports));
		},
		1549: function (t) {
			((t.exports = function () {
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
			}),
				(t.exports.__esModule = !0),
				(t.exports.default = t.exports));
		},
		1557: function (t) {
			((t.exports = function (t) {
				if (
					('undefined' !== typeof Symbol && null != t[Symbol.iterator]) ||
					null != t['@@iterator']
				)
					return Array.from(t);
			}),
				(t.exports.__esModule = !0),
				(t.exports.default = t.exports));
		},
		981: function (t) {
			((t.exports = function (t, e) {
				var r =
					null == t
						? null
						: ('undefined' !== typeof Symbol && t[Symbol.iterator]) || t['@@iterator'];
				if (null != r) {
					var n,
						o,
						i = [],
						s = !0,
						u = !1;
					try {
						for (
							r = r.call(t);
							!(s = (n = r.next()).done) && (i.push(n.value), !e || i.length !== e);
							s = !0
						);
					} catch (f) {
						((u = !0), (o = f));
					} finally {
						try {
							s || null == r.return || r.return();
						} finally {
							if (u) throw o;
						}
					}
					return i;
				}
			}),
				(t.exports.__esModule = !0),
				(t.exports.default = t.exports));
		},
		7365: function (t) {
			((t.exports = function () {
				throw new TypeError(
					'Invalid attempt to destructure non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.'
				);
			}),
				(t.exports.__esModule = !0),
				(t.exports.default = t.exports));
		},
		1359: function (t) {
			((t.exports = function () {
				throw new TypeError(
					'Invalid attempt to spread non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.'
				);
			}),
				(t.exports.__esModule = !0),
				(t.exports.default = t.exports));
		},
		417: function (t, e, r) {
			var n = r(1260);
			function o(t, e) {
				var r = Object.keys(t);
				if (Object.getOwnPropertySymbols) {
					var n = Object.getOwnPropertySymbols(t);
					(e &&
						(n = n.filter(function (e) {
							return Object.getOwnPropertyDescriptor(t, e).enumerable;
						})),
						r.push.apply(r, n));
				}
				return r;
			}
			((t.exports = function (t) {
				for (var e = 1; e < arguments.length; e++) {
					var r = null != arguments[e] ? arguments[e] : {};
					e % 2
						? o(Object(r), !0).forEach(function (e) {
								n(t, e, r[e]);
							})
						: Object.getOwnPropertyDescriptors
							? Object.defineProperties(t, Object.getOwnPropertyDescriptors(r))
							: o(Object(r)).forEach(function (e) {
									Object.defineProperty(
										t,
										e,
										Object.getOwnPropertyDescriptor(r, e)
									);
								});
				}
				return t;
			}),
				(t.exports.__esModule = !0),
				(t.exports.default = t.exports));
		},
		6983: function (t, e, r) {
			var n = r(8921).default,
				o = r(8111);
			((t.exports = function (t, e) {
				if (e && ('object' === n(e) || 'function' === typeof e)) return e;
				if (void 0 !== e)
					throw new TypeError('Derived constructors may only return object or undefined');
				return o(t);
			}),
				(t.exports.__esModule = !0),
				(t.exports.default = t.exports));
		},
		742: function (t) {
			function e(r, n) {
				return (
					(t.exports = e =
						Object.setPrototypeOf ||
						function (t, e) {
							return ((t.__proto__ = e), t);
						}),
					(t.exports.__esModule = !0),
					(t.exports.default = t.exports),
					e(r, n)
				);
			}
			((t.exports = e), (t.exports.__esModule = !0), (t.exports.default = t.exports));
		},
		1068: function (t, e, r) {
			var n = r(4180),
				o = r(981),
				i = r(6487),
				s = r(7365);
			((t.exports = function (t, e) {
				return n(t) || o(t, e) || i(t, e) || s();
			}),
				(t.exports.__esModule = !0),
				(t.exports.default = t.exports));
		},
		5182: function (t, e, r) {
			var n = r(1232),
				o = r(1557),
				i = r(6487),
				s = r(1359);
			((t.exports = function (t) {
				return n(t) || o(t) || i(t) || s();
			}),
				(t.exports.__esModule = !0),
				(t.exports.default = t.exports));
		},
		8921: function (t) {
			function e(r) {
				return (
					(t.exports = e =
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
					(t.exports.__esModule = !0),
					(t.exports.default = t.exports),
					e(r)
				);
			}
			((t.exports = e), (t.exports.__esModule = !0), (t.exports.default = t.exports));
		},
		6487: function (t, e, r) {
			var n = r(5270);
			((t.exports = function (t, e) {
				if (t) {
					if ('string' === typeof t) return n(t, e);
					var r = Object.prototype.toString.call(t).slice(8, -1);
					return (
						'Object' === r && t.constructor && (r = t.constructor.name),
						'Map' === r || 'Set' === r
							? Array.from(t)
							: 'Arguments' === r ||
								  /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(r)
								? n(t, e)
								: void 0
					);
				}
			}),
				(t.exports.__esModule = !0),
				(t.exports.default = t.exports));
		},
		9998: function (t) {
			'use strict';
			t.exports = function (t, e) {
				var r = new Array(arguments.length - 1),
					n = 0,
					o = 2,
					i = !0;
				for (; o < arguments.length; ) r[n++] = arguments[o++];
				return new Promise(function (o, s) {
					r[n] = function (t) {
						if (i)
							if (((i = !1), t)) s(t);
							else {
								for (var e = new Array(arguments.length - 1), r = 0; r < e.length; )
									e[r++] = arguments[r];
								o.apply(null, e);
							}
					};
					try {
						t.apply(e || null, r);
					} catch (u) {
						i && ((i = !1), s(u));
					}
				});
			};
		},
		5368: function (t, e) {
			'use strict';
			var r = e;
			r.length = function (t) {
				var e = t.length;
				if (!e) return 0;
				for (var r = 0; --e % 4 > 1 && '=' === t.charAt(e); ) ++r;
				return Math.ceil(3 * t.length) / 4 - r;
			};
			for (var n = new Array(64), o = new Array(123), i = 0; i < 64; )
				o[(n[i] = i < 26 ? i + 65 : i < 52 ? i + 71 : i < 62 ? i - 4 : (i - 59) | 43)] =
					i++;
			r.encode = function (t, e, r) {
				for (var o, i = null, s = [], u = 0, f = 0; e < r; ) {
					var l = t[e++];
					switch (f) {
						case 0:
							((s[u++] = n[l >> 2]), (o = (3 & l) << 4), (f = 1));
							break;
						case 1:
							((s[u++] = n[o | (l >> 4)]), (o = (15 & l) << 2), (f = 2));
							break;
						case 2:
							((s[u++] = n[o | (l >> 6)]), (s[u++] = n[63 & l]), (f = 0));
					}
					u > 8191 &&
						((i || (i = [])).push(String.fromCharCode.apply(String, s)), (u = 0));
				}
				return (
					f && ((s[u++] = n[o]), (s[u++] = 61), 1 === f && (s[u++] = 61)),
					i
						? (u && i.push(String.fromCharCode.apply(String, s.slice(0, u))),
							i.join(''))
						: String.fromCharCode.apply(String, s.slice(0, u))
				);
			};
			var s = 'invalid encoding';
			((r.decode = function (t, e, r) {
				for (var n, i = r, u = 0, f = 0; f < t.length; ) {
					var l = t.charCodeAt(f++);
					if (61 === l && u > 1) break;
					if (void 0 === (l = o[l])) throw Error(s);
					switch (u) {
						case 0:
							((n = l), (u = 1));
							break;
						case 1:
							((e[r++] = (n << 2) | ((48 & l) >> 4)), (n = l), (u = 2));
							break;
						case 2:
							((e[r++] = ((15 & n) << 4) | ((60 & l) >> 2)), (n = l), (u = 3));
							break;
						case 3:
							((e[r++] = ((3 & n) << 6) | l), (u = 0));
					}
				}
				if (1 === u) throw Error(s);
				return r - i;
			}),
				(r.test = function (t) {
					return /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(
						t
					);
				}));
		},
		235: function (t) {
			'use strict';
			function e() {
				this._listeners = {};
			}
			((t.exports = e),
				(e.prototype.on = function (t, e, r) {
					return (
						(this._listeners[t] || (this._listeners[t] = [])).push({
							fn: e,
							ctx: r || this
						}),
						this
					);
				}),
				(e.prototype.off = function (t, e) {
					if (void 0 === t) this._listeners = {};
					else if (void 0 === e) this._listeners[t] = [];
					else
						for (var r = this._listeners[t], n = 0; n < r.length; )
							r[n].fn === e ? r.splice(n, 1) : ++n;
					return this;
				}),
				(e.prototype.emit = function (t) {
					var e = this._listeners[t];
					if (e) {
						for (var r = [], n = 1; n < arguments.length; ) r.push(arguments[n++]);
						for (n = 0; n < e.length; ) e[n].fn.apply(e[n++].ctx, r);
					}
					return this;
				}));
		},
		700: function (t) {
			'use strict';
			function e(t) {
				return (
					'undefined' !== typeof Float32Array
						? (function () {
								var e = new Float32Array([-0]),
									r = new Uint8Array(e.buffer),
									n = 128 === r[3];
								function o(t, n, o) {
									((e[0] = t),
										(n[o] = r[0]),
										(n[o + 1] = r[1]),
										(n[o + 2] = r[2]),
										(n[o + 3] = r[3]));
								}
								function i(t, n, o) {
									((e[0] = t),
										(n[o] = r[3]),
										(n[o + 1] = r[2]),
										(n[o + 2] = r[1]),
										(n[o + 3] = r[0]));
								}
								function s(t, n) {
									return (
										(r[0] = t[n]),
										(r[1] = t[n + 1]),
										(r[2] = t[n + 2]),
										(r[3] = t[n + 3]),
										e[0]
									);
								}
								function u(t, n) {
									return (
										(r[3] = t[n]),
										(r[2] = t[n + 1]),
										(r[1] = t[n + 2]),
										(r[0] = t[n + 3]),
										e[0]
									);
								}
								((t.writeFloatLE = n ? o : i),
									(t.writeFloatBE = n ? i : o),
									(t.readFloatLE = n ? s : u),
									(t.readFloatBE = n ? u : s));
							})()
						: (function () {
								function e(t, e, r, n) {
									var o = e < 0 ? 1 : 0;
									if ((o && (e = -e), 0 === e))
										t(1 / e > 0 ? 0 : 2147483648, r, n);
									else if (isNaN(e)) t(2143289344, r, n);
									else if (e > 34028234663852886e22)
										t(((o << 31) | 2139095040) >>> 0, r, n);
									else if (e < 11754943508222875e-54)
										t(
											((o << 31) | Math.round(e / 1401298464324817e-60)) >>>
												0,
											r,
											n
										);
									else {
										var i = Math.floor(Math.log(e) / Math.LN2);
										t(
											((o << 31) |
												((i + 127) << 23) |
												(8388607 &
													Math.round(e * Math.pow(2, -i) * 8388608))) >>>
												0,
											r,
											n
										);
									}
								}
								function s(t, e, r) {
									var n = t(e, r),
										o = 2 * (n >> 31) + 1,
										i = (n >>> 23) & 255,
										s = 8388607 & n;
									return 255 === i
										? s
											? NaN
											: o * (1 / 0)
										: 0 === i
											? 1401298464324817e-60 * o * s
											: o * Math.pow(2, i - 150) * (s + 8388608);
								}
								((t.writeFloatLE = e.bind(null, r)),
									(t.writeFloatBE = e.bind(null, n)),
									(t.readFloatLE = s.bind(null, o)),
									(t.readFloatBE = s.bind(null, i)));
							})(),
					'undefined' !== typeof Float64Array
						? (function () {
								var e = new Float64Array([-0]),
									r = new Uint8Array(e.buffer),
									n = 128 === r[7];
								function o(t, n, o) {
									((e[0] = t),
										(n[o] = r[0]),
										(n[o + 1] = r[1]),
										(n[o + 2] = r[2]),
										(n[o + 3] = r[3]),
										(n[o + 4] = r[4]),
										(n[o + 5] = r[5]),
										(n[o + 6] = r[6]),
										(n[o + 7] = r[7]));
								}
								function i(t, n, o) {
									((e[0] = t),
										(n[o] = r[7]),
										(n[o + 1] = r[6]),
										(n[o + 2] = r[5]),
										(n[o + 3] = r[4]),
										(n[o + 4] = r[3]),
										(n[o + 5] = r[2]),
										(n[o + 6] = r[1]),
										(n[o + 7] = r[0]));
								}
								function s(t, n) {
									return (
										(r[0] = t[n]),
										(r[1] = t[n + 1]),
										(r[2] = t[n + 2]),
										(r[3] = t[n + 3]),
										(r[4] = t[n + 4]),
										(r[5] = t[n + 5]),
										(r[6] = t[n + 6]),
										(r[7] = t[n + 7]),
										e[0]
									);
								}
								function u(t, n) {
									return (
										(r[7] = t[n]),
										(r[6] = t[n + 1]),
										(r[5] = t[n + 2]),
										(r[4] = t[n + 3]),
										(r[3] = t[n + 4]),
										(r[2] = t[n + 5]),
										(r[1] = t[n + 6]),
										(r[0] = t[n + 7]),
										e[0]
									);
								}
								((t.writeDoubleLE = n ? o : i),
									(t.writeDoubleBE = n ? i : o),
									(t.readDoubleLE = n ? s : u),
									(t.readDoubleBE = n ? u : s));
							})()
						: (function () {
								function e(t, e, r, n, o, i) {
									var s = n < 0 ? 1 : 0;
									if ((s && (n = -n), 0 === n))
										(t(0, o, i + e), t(1 / n > 0 ? 0 : 2147483648, o, i + r));
									else if (isNaN(n)) (t(0, o, i + e), t(2146959360, o, i + r));
									else if (n > 17976931348623157e292)
										(t(0, o, i + e),
											t(((s << 31) | 2146435072) >>> 0, o, i + r));
									else {
										var u;
										if (n < 22250738585072014e-324)
											(t((u = n / 5e-324) >>> 0, o, i + e),
												t(((s << 31) | (u / 4294967296)) >>> 0, o, i + r));
										else {
											var f = Math.floor(Math.log(n) / Math.LN2);
											(1024 === f && (f = 1023),
												t(
													(4503599627370496 *
														(u = n * Math.pow(2, -f))) >>>
														0,
													o,
													i + e
												),
												t(
													((s << 31) |
														((f + 1023) << 20) |
														((1048576 * u) & 1048575)) >>>
														0,
													o,
													i + r
												));
										}
									}
								}
								function s(t, e, r, n, o) {
									var i = t(n, o + e),
										s = t(n, o + r),
										u = 2 * (s >> 31) + 1,
										f = (s >>> 20) & 2047,
										l = 4294967296 * (1048575 & s) + i;
									return 2047 === f
										? l
											? NaN
											: u * (1 / 0)
										: 0 === f
											? 5e-324 * u * l
											: u * Math.pow(2, f - 1075) * (l + 4503599627370496);
								}
								((t.writeDoubleLE = e.bind(null, r, 0, 4)),
									(t.writeDoubleBE = e.bind(null, n, 4, 0)),
									(t.readDoubleLE = s.bind(null, o, 0, 4)),
									(t.readDoubleBE = s.bind(null, i, 4, 0)));
							})(),
					t
				);
			}
			function r(t, e, r) {
				((e[r] = 255 & t),
					(e[r + 1] = (t >>> 8) & 255),
					(e[r + 2] = (t >>> 16) & 255),
					(e[r + 3] = t >>> 24));
			}
			function n(t, e, r) {
				((e[r] = t >>> 24),
					(e[r + 1] = (t >>> 16) & 255),
					(e[r + 2] = (t >>> 8) & 255),
					(e[r + 3] = 255 & t));
			}
			function o(t, e) {
				return (t[e] | (t[e + 1] << 8) | (t[e + 2] << 16) | (t[e + 3] << 24)) >>> 0;
			}
			function i(t, e) {
				return ((t[e] << 24) | (t[e + 1] << 16) | (t[e + 2] << 8) | t[e + 3]) >>> 0;
			}
			t.exports = e(e);
		},
		6416: function (module) {
			'use strict';
			function inquire(moduleName) {
				try {
					var mod = eval('quire'.replace(/^/, 're'))(moduleName);
					if (mod && (mod.length || Object.keys(mod).length)) return mod;
				} catch (e) {}
				return null;
			}
			module.exports = inquire;
		},
		8683: function (t) {
			'use strict';
			t.exports = function (t, e, r) {
				var n = r || 8192,
					o = n >>> 1,
					i = null,
					s = n;
				return function (r) {
					if (r < 1 || r > o) return t(r);
					s + r > n && ((i = t(n)), (s = 0));
					var u = e.call(i, s, (s += r));
					return (7 & s && (s = 1 + (7 | s)), u);
				};
			};
		},
		4: function (t, e) {
			'use strict';
			var r = e;
			((r.length = function (t) {
				for (var e = 0, r = 0, n = 0; n < t.length; ++n)
					(r = t.charCodeAt(n)) < 128
						? (e += 1)
						: r < 2048
							? (e += 2)
							: 55296 === (64512 & r) && 56320 === (64512 & t.charCodeAt(n + 1))
								? (++n, (e += 4))
								: (e += 3);
				return e;
			}),
				(r.read = function (t, e, r) {
					if (r - e < 1) return '';
					for (var n, o = null, i = [], s = 0; e < r; )
						((n = t[e++]) < 128
							? (i[s++] = n)
							: n > 191 && n < 224
								? (i[s++] = ((31 & n) << 6) | (63 & t[e++]))
								: n > 239 && n < 365
									? ((n =
											(((7 & n) << 18) |
												((63 & t[e++]) << 12) |
												((63 & t[e++]) << 6) |
												(63 & t[e++])) -
											65536),
										(i[s++] = 55296 + (n >> 10)),
										(i[s++] = 56320 + (1023 & n)))
									: (i[s++] =
											((15 & n) << 12) |
											((63 & t[e++]) << 6) |
											(63 & t[e++])),
							s > 8191 &&
								((o || (o = [])).push(String.fromCharCode.apply(String, i)),
								(s = 0)));
					return o
						? (s && o.push(String.fromCharCode.apply(String, i.slice(0, s))),
							o.join(''))
						: String.fromCharCode.apply(String, i.slice(0, s));
				}),
				(r.write = function (t, e, r) {
					for (var n, o, i = r, s = 0; s < t.length; ++s)
						(n = t.charCodeAt(s)) < 128
							? (e[r++] = n)
							: n < 2048
								? ((e[r++] = (n >> 6) | 192), (e[r++] = (63 & n) | 128))
								: 55296 === (64512 & n) &&
									  56320 === (64512 & (o = t.charCodeAt(s + 1)))
									? ((n = 65536 + ((1023 & n) << 10) + (1023 & o)),
										++s,
										(e[r++] = (n >> 18) | 240),
										(e[r++] = ((n >> 12) & 63) | 128),
										(e[r++] = ((n >> 6) & 63) | 128),
										(e[r++] = (63 & n) | 128))
									: ((e[r++] = (n >> 12) | 224),
										(e[r++] = ((n >> 6) & 63) | 128),
										(e[r++] = (63 & n) | 128));
					return r - i;
				}));
		},
		7796: function (t, e, r) {
			'use strict';
			t.exports = r(3740);
		},
		3740: function (t, e, r) {
			'use strict';
			var n = e;
			function o() {
				(n.util._configure(),
					n.Writer._configure(n.BufferWriter),
					n.Reader._configure(n.BufferReader));
			}
			((n.build = 'minimal'),
				(n.Writer = r(9687)),
				(n.BufferWriter = r(7159)),
				(n.Reader = r(9376)),
				(n.BufferReader = r(5258)),
				(n.util = r(7067)),
				(n.rpc = r(6371)),
				(n.roots = r(5548)),
				(n.configure = o),
				o());
		},
		9376: function (t, e, r) {
			'use strict';
			t.exports = f;
			var n,
				o = r(7067),
				i = o.LongBits,
				s = o.utf8;
			function u(t, e) {
				return RangeError(
					'index out of range: ' + t.pos + ' + ' + (e || 1) + ' > ' + t.len
				);
			}
			function f(t) {
				((this.buf = t), (this.pos = 0), (this.len = t.length));
			}
			var l =
					'undefined' !== typeof Uint8Array
						? function (t) {
								if (t instanceof Uint8Array || Array.isArray(t)) return new f(t);
								throw Error('illegal buffer');
							}
						: function (t) {
								if (Array.isArray(t)) return new f(t);
								throw Error('illegal buffer');
							},
				c = function () {
					return o.Buffer
						? function (t) {
								return (f.create = function (t) {
									return o.Buffer.isBuffer(t) ? new n(t) : l(t);
								})(t);
							}
						: l;
				};
			function a() {
				var t = new i(0, 0),
					e = 0;
				if (!(this.len - this.pos > 4)) {
					for (; e < 3; ++e) {
						if (this.pos >= this.len) throw u(this);
						if (
							((t.lo = (t.lo | ((127 & this.buf[this.pos]) << (7 * e))) >>> 0),
							this.buf[this.pos++] < 128)
						)
							return t;
					}
					return ((t.lo = (t.lo | ((127 & this.buf[this.pos++]) << (7 * e))) >>> 0), t);
				}
				for (; e < 4; ++e)
					if (
						((t.lo = (t.lo | ((127 & this.buf[this.pos]) << (7 * e))) >>> 0),
						this.buf[this.pos++] < 128)
					)
						return t;
				if (
					((t.lo = (t.lo | ((127 & this.buf[this.pos]) << 28)) >>> 0),
					(t.hi = (t.hi | ((127 & this.buf[this.pos]) >> 4)) >>> 0),
					this.buf[this.pos++] < 128)
				)
					return t;
				if (((e = 0), this.len - this.pos > 4)) {
					for (; e < 5; ++e)
						if (
							((t.hi = (t.hi | ((127 & this.buf[this.pos]) << (7 * e + 3))) >>> 0),
							this.buf[this.pos++] < 128)
						)
							return t;
				} else
					for (; e < 5; ++e) {
						if (this.pos >= this.len) throw u(this);
						if (
							((t.hi = (t.hi | ((127 & this.buf[this.pos]) << (7 * e + 3))) >>> 0),
							this.buf[this.pos++] < 128)
						)
							return t;
					}
				throw Error('invalid varint encoding');
			}
			function p(t, e) {
				return (t[e - 4] | (t[e - 3] << 8) | (t[e - 2] << 16) | (t[e - 1] << 24)) >>> 0;
			}
			function h() {
				if (this.pos + 8 > this.len) throw u(this, 8);
				return new i(p(this.buf, (this.pos += 4)), p(this.buf, (this.pos += 4)));
			}
			((f.create = c()),
				(f.prototype._slice = o.Array.prototype.subarray || o.Array.prototype.slice),
				(f.prototype.uint32 = (function () {
					var t = 4294967295;
					return function () {
						if (((t = (127 & this.buf[this.pos]) >>> 0), this.buf[this.pos++] < 128))
							return t;
						if (
							((t = (t | ((127 & this.buf[this.pos]) << 7)) >>> 0),
							this.buf[this.pos++] < 128)
						)
							return t;
						if (
							((t = (t | ((127 & this.buf[this.pos]) << 14)) >>> 0),
							this.buf[this.pos++] < 128)
						)
							return t;
						if (
							((t = (t | ((127 & this.buf[this.pos]) << 21)) >>> 0),
							this.buf[this.pos++] < 128)
						)
							return t;
						if (
							((t = (t | ((15 & this.buf[this.pos]) << 28)) >>> 0),
							this.buf[this.pos++] < 128)
						)
							return t;
						if ((this.pos += 5) > this.len) throw ((this.pos = this.len), u(this, 10));
						return t;
					};
				})()),
				(f.prototype.int32 = function () {
					return 0 | this.uint32();
				}),
				(f.prototype.sint32 = function () {
					var t = this.uint32();
					return ((t >>> 1) ^ -(1 & t)) | 0;
				}),
				(f.prototype.bool = function () {
					return 0 !== this.uint32();
				}),
				(f.prototype.fixed32 = function () {
					if (this.pos + 4 > this.len) throw u(this, 4);
					return p(this.buf, (this.pos += 4));
				}),
				(f.prototype.sfixed32 = function () {
					if (this.pos + 4 > this.len) throw u(this, 4);
					return 0 | p(this.buf, (this.pos += 4));
				}),
				(f.prototype.float = function () {
					if (this.pos + 4 > this.len) throw u(this, 4);
					var t = o.float.readFloatLE(this.buf, this.pos);
					return ((this.pos += 4), t);
				}),
				(f.prototype.double = function () {
					if (this.pos + 8 > this.len) throw u(this, 4);
					var t = o.float.readDoubleLE(this.buf, this.pos);
					return ((this.pos += 8), t);
				}),
				(f.prototype.bytes = function () {
					var t = this.uint32(),
						e = this.pos,
						r = this.pos + t;
					if (r > this.len) throw u(this, t);
					return (
						(this.pos += t),
						Array.isArray(this.buf)
							? this.buf.slice(e, r)
							: e === r
								? new this.buf.constructor(0)
								: this._slice.call(this.buf, e, r)
					);
				}),
				(f.prototype.string = function () {
					var t = this.bytes();
					return s.read(t, 0, t.length);
				}),
				(f.prototype.skip = function (t) {
					if ('number' === typeof t) {
						if (this.pos + t > this.len) throw u(this, t);
						this.pos += t;
					} else
						do {
							if (this.pos >= this.len) throw u(this);
						} while (128 & this.buf[this.pos++]);
					return this;
				}),
				(f.prototype.skipType = function (t) {
					switch (t) {
						case 0:
							this.skip();
							break;
						case 1:
							this.skip(8);
							break;
						case 2:
							this.skip(this.uint32());
							break;
						case 3:
							for (; 4 !== (t = 7 & this.uint32()); ) this.skipType(t);
							break;
						case 5:
							this.skip(4);
							break;
						default:
							throw Error('invalid wire type ' + t + ' at offset ' + this.pos);
					}
					return this;
				}),
				(f._configure = function (t) {
					((n = t), (f.create = c()), n._configure());
					var e = o.Long ? 'toLong' : 'toNumber';
					o.merge(f.prototype, {
						int64: function () {
							return a.call(this)[e](!1);
						},
						uint64: function () {
							return a.call(this)[e](!0);
						},
						sint64: function () {
							return a.call(this).zzDecode()[e](!1);
						},
						fixed64: function () {
							return h.call(this)[e](!0);
						},
						sfixed64: function () {
							return h.call(this)[e](!1);
						}
					});
				}));
		},
		5258: function (t, e, r) {
			'use strict';
			t.exports = i;
			var n = r(9376);
			(i.prototype = Object.create(n.prototype)).constructor = i;
			var o = r(7067);
			function i(t) {
				n.call(this, t);
			}
			((i._configure = function () {
				o.Buffer && (i.prototype._slice = o.Buffer.prototype.slice);
			}),
				(i.prototype.string = function () {
					var t = this.uint32();
					return this.buf.utf8Slice
						? this.buf.utf8Slice(
								this.pos,
								(this.pos = Math.min(this.pos + t, this.len))
							)
						: this.buf.toString(
								'utf-8',
								this.pos,
								(this.pos = Math.min(this.pos + t, this.len))
							);
				}),
				i._configure());
		},
		5548: function (t) {
			'use strict';
			t.exports = {};
		},
		6371: function (t, e, r) {
			'use strict';
			e.Service = r(8292);
		},
		8292: function (t, e, r) {
			'use strict';
			t.exports = o;
			var n = r(7067);
			function o(t, e, r) {
				if ('function' !== typeof t) throw TypeError('rpcImpl must be a function');
				(n.EventEmitter.call(this),
					(this.rpcImpl = t),
					(this.requestDelimited = Boolean(e)),
					(this.responseDelimited = Boolean(r)));
			}
			(((o.prototype = Object.create(n.EventEmitter.prototype)).constructor = o),
				(o.prototype.rpcCall = function t(e, r, o, i, s) {
					if (!i) throw TypeError('request must be specified');
					var u = this;
					if (!s) return n.asPromise(t, u, e, r, o, i);
					if (u.rpcImpl)
						try {
							return u.rpcImpl(
								e,
								r[u.requestDelimited ? 'encodeDelimited' : 'encode'](i).finish(),
								function (t, r) {
									if (t) return (u.emit('error', t, e), s(t));
									if (null !== r) {
										if (!(r instanceof o))
											try {
												r =
													o[
														u.responseDelimited
															? 'decodeDelimited'
															: 'decode'
													](r);
											} catch (t) {
												return (u.emit('error', t, e), s(t));
											}
										return (u.emit('data', r, e), s(null, r));
									}
									u.end(!0);
								}
							);
						} catch (f) {
							return (
								u.emit('error', f, e),
								void setTimeout(function () {
									s(f);
								}, 0)
							);
						}
					else
						setTimeout(function () {
							s(Error('already ended'));
						}, 0);
				}),
				(o.prototype.end = function (t) {
					return (
						this.rpcImpl &&
							(t || this.rpcImpl(null, null, null),
							(this.rpcImpl = null),
							this.emit('end').off()),
						this
					);
				}));
		},
		2526: function (t, e, r) {
			'use strict';
			t.exports = o;
			var n = r(7067);
			function o(t, e) {
				((this.lo = t >>> 0), (this.hi = e >>> 0));
			}
			var i = (o.zero = new o(0, 0));
			((i.toNumber = function () {
				return 0;
			}),
				(i.zzEncode = i.zzDecode =
					function () {
						return this;
					}),
				(i.length = function () {
					return 1;
				}));
			var s = (o.zeroHash = '\0\0\0\0\0\0\0\0');
			((o.fromNumber = function (t) {
				if (0 === t) return i;
				var e = t < 0;
				e && (t = -t);
				var r = t >>> 0,
					n = ((t - r) / 4294967296) >>> 0;
				return (
					e &&
						((n = ~n >>> 0),
						(r = ~r >>> 0),
						++r > 4294967295 && ((r = 0), ++n > 4294967295 && (n = 0))),
					new o(r, n)
				);
			}),
				(o.from = function (t) {
					if ('number' === typeof t) return o.fromNumber(t);
					if (n.isString(t)) {
						if (!n.Long) return o.fromNumber(parseInt(t, 10));
						t = n.Long.fromString(t);
					}
					return t.low || t.high ? new o(t.low >>> 0, t.high >>> 0) : i;
				}),
				(o.prototype.toNumber = function (t) {
					if (!t && this.hi >>> 31) {
						var e = (1 + ~this.lo) >>> 0,
							r = ~this.hi >>> 0;
						return (e || (r = (r + 1) >>> 0), -(e + 4294967296 * r));
					}
					return this.lo + 4294967296 * this.hi;
				}),
				(o.prototype.toLong = function (t) {
					return n.Long
						? new n.Long(0 | this.lo, 0 | this.hi, Boolean(t))
						: { low: 0 | this.lo, high: 0 | this.hi, unsigned: Boolean(t) };
				}));
			var u = String.prototype.charCodeAt;
			((o.fromHash = function (t) {
				return t === s
					? i
					: new o(
							(u.call(t, 0) |
								(u.call(t, 1) << 8) |
								(u.call(t, 2) << 16) |
								(u.call(t, 3) << 24)) >>>
								0,
							(u.call(t, 4) |
								(u.call(t, 5) << 8) |
								(u.call(t, 6) << 16) |
								(u.call(t, 7) << 24)) >>>
								0
						);
			}),
				(o.prototype.toHash = function () {
					return String.fromCharCode(
						255 & this.lo,
						(this.lo >>> 8) & 255,
						(this.lo >>> 16) & 255,
						this.lo >>> 24,
						255 & this.hi,
						(this.hi >>> 8) & 255,
						(this.hi >>> 16) & 255,
						this.hi >>> 24
					);
				}),
				(o.prototype.zzEncode = function () {
					var t = this.hi >> 31;
					return (
						(this.hi = (((this.hi << 1) | (this.lo >>> 31)) ^ t) >>> 0),
						(this.lo = ((this.lo << 1) ^ t) >>> 0),
						this
					);
				}),
				(o.prototype.zzDecode = function () {
					var t = -(1 & this.lo);
					return (
						(this.lo = (((this.lo >>> 1) | (this.hi << 31)) ^ t) >>> 0),
						(this.hi = ((this.hi >>> 1) ^ t) >>> 0),
						this
					);
				}),
				(o.prototype.length = function () {
					var t = this.lo,
						e = ((this.lo >>> 28) | (this.hi << 4)) >>> 0,
						r = this.hi >>> 24;
					return 0 === r
						? 0 === e
							? t < 16384
								? t < 128
									? 1
									: 2
								: t < 2097152
									? 3
									: 4
							: e < 16384
								? e < 128
									? 5
									: 6
								: e < 2097152
									? 7
									: 8
						: r < 128
							? 9
							: 10;
				}));
		},
		7067: function (t, e, r) {
			'use strict';
			var n = e;
			function o(t, e, r) {
				for (var n = Object.keys(e), o = 0; o < n.length; ++o)
					(void 0 !== t[n[o]] && r) || (t[n[o]] = e[n[o]]);
				return t;
			}
			function i(t) {
				function e(t, r) {
					if (!(this instanceof e)) return new e(t, r);
					(Object.defineProperty(this, 'message', {
						get: function () {
							return t;
						}
					}),
						Error.captureStackTrace
							? Error.captureStackTrace(this, e)
							: Object.defineProperty(this, 'stack', {
									value: new Error().stack || ''
								}),
						r && o(this, r));
				}
				return (
					((e.prototype = Object.create(Error.prototype)).constructor = e),
					Object.defineProperty(e.prototype, 'name', {
						get: function () {
							return t;
						}
					}),
					(e.prototype.toString = function () {
						return this.name + ': ' + this.message;
					}),
					e
				);
			}
			((n.asPromise = r(9998)),
				(n.base64 = r(5368)),
				(n.EventEmitter = r(235)),
				(n.float = r(700)),
				(n.inquire = r(6416)),
				(n.utf8 = r(4)),
				(n.pool = r(8683)),
				(n.LongBits = r(2526)),
				(n.isNode = Boolean(
					'undefined' !== typeof r.g &&
						r.g &&
						r.g.process &&
						r.g.process.versions &&
						r.g.process.versions.node
				)),
				(n.global =
					(n.isNode && r.g) ||
					('undefined' !== typeof window && window) ||
					('undefined' !== typeof self && self) ||
					this),
				(n.emptyArray = Object.freeze ? Object.freeze([]) : []),
				(n.emptyObject = Object.freeze ? Object.freeze({}) : {}),
				(n.isInteger =
					Number.isInteger ||
					function (t) {
						return 'number' === typeof t && isFinite(t) && Math.floor(t) === t;
					}),
				(n.isString = function (t) {
					return 'string' === typeof t || t instanceof String;
				}),
				(n.isObject = function (t) {
					return t && 'object' === typeof t;
				}),
				(n.isset = n.isSet =
					function (t, e) {
						var r = t[e];
						return (
							!(null == r || !t.hasOwnProperty(e)) &&
							('object' !== typeof r ||
								(Array.isArray(r) ? r.length : Object.keys(r).length) > 0)
						);
					}),
				(n.Buffer = (function () {
					try {
						var t = n.inquire('buffer').Buffer;
						return t.prototype.utf8Write ? t : null;
					} catch (e) {
						return null;
					}
				})()),
				(n._Buffer_from = null),
				(n._Buffer_allocUnsafe = null),
				(n.newBuffer = function (t) {
					return 'number' === typeof t
						? n.Buffer
							? n._Buffer_allocUnsafe(t)
							: new n.Array(t)
						: n.Buffer
							? n._Buffer_from(t)
							: 'undefined' === typeof Uint8Array
								? t
								: new Uint8Array(t);
				}),
				(n.Array = 'undefined' !== typeof Uint8Array ? Uint8Array : Array),
				(n.Long =
					(n.global.dcodeIO && n.global.dcodeIO.Long) ||
					n.global.Long ||
					n.inquire('long')),
				(n.key2Re = /^true|false|0|1$/),
				(n.key32Re = /^-?(?:0|[1-9][0-9]*)$/),
				(n.key64Re = /^(?:[\\x00-\\xff]{8}|-?(?:0|[1-9][0-9]*))$/),
				(n.longToHash = function (t) {
					return t ? n.LongBits.from(t).toHash() : n.LongBits.zeroHash;
				}),
				(n.longFromHash = function (t, e) {
					var r = n.LongBits.fromHash(t);
					return n.Long ? n.Long.fromBits(r.lo, r.hi, e) : r.toNumber(Boolean(e));
				}),
				(n.merge = o),
				(n.lcFirst = function (t) {
					return t.charAt(0).toLowerCase() + t.substring(1);
				}),
				(n.newError = i),
				(n.ProtocolError = i('ProtocolError')),
				(n.oneOfGetter = function (t) {
					for (var e = {}, r = 0; r < t.length; ++r) e[t[r]] = 1;
					return function () {
						for (var t = Object.keys(this), r = t.length - 1; r > -1; --r)
							if (1 === e[t[r]] && void 0 !== this[t[r]] && null !== this[t[r]])
								return t[r];
					};
				}),
				(n.oneOfSetter = function (t) {
					return function (e) {
						for (var r = 0; r < t.length; ++r) t[r] !== e && delete this[t[r]];
					};
				}),
				(n.toJSONOptions = { longs: String, enums: String, bytes: String, json: !0 }),
				(n._configure = function () {
					var t = n.Buffer;
					t
						? ((n._Buffer_from =
								(t.from !== Uint8Array.from && t.from) ||
								function (e, r) {
									return new t(e, r);
								}),
							(n._Buffer_allocUnsafe =
								t.allocUnsafe ||
								function (e) {
									return new t(e);
								}))
						: (n._Buffer_from = n._Buffer_allocUnsafe = null);
				}));
		},
		9687: function (t, e, r) {
			'use strict';
			t.exports = a;
			var n,
				o = r(7067),
				i = o.LongBits,
				s = o.base64,
				u = o.utf8;
			function f(t, e, r) {
				((this.fn = t), (this.len = e), (this.next = void 0), (this.val = r));
			}
			function l() {}
			function c(t) {
				((this.head = t.head),
					(this.tail = t.tail),
					(this.len = t.len),
					(this.next = t.states));
			}
			function a() {
				((this.len = 0),
					(this.head = new f(l, 0, 0)),
					(this.tail = this.head),
					(this.states = null));
			}
			var p = function () {
				return o.Buffer
					? function () {
							return (a.create = function () {
								return new n();
							})();
						}
					: function () {
							return new a();
						};
			};
			function h(t, e, r) {
				e[r] = 255 & t;
			}
			function y(t, e) {
				((this.len = t), (this.next = void 0), (this.val = e));
			}
			function d(t, e, r) {
				for (; t.hi; )
					((e[r++] = (127 & t.lo) | 128),
						(t.lo = ((t.lo >>> 7) | (t.hi << 25)) >>> 0),
						(t.hi >>>= 7));
				for (; t.lo > 127; ) ((e[r++] = (127 & t.lo) | 128), (t.lo = t.lo >>> 7));
				e[r++] = t.lo;
			}
			function b(t, e, r) {
				((e[r] = 255 & t),
					(e[r + 1] = (t >>> 8) & 255),
					(e[r + 2] = (t >>> 16) & 255),
					(e[r + 3] = t >>> 24));
			}
			((a.create = p()),
				(a.alloc = function (t) {
					return new o.Array(t);
				}),
				o.Array !== Array && (a.alloc = o.pool(a.alloc, o.Array.prototype.subarray)),
				(a.prototype._push = function (t, e, r) {
					return ((this.tail = this.tail.next = new f(t, e, r)), (this.len += e), this);
				}),
				(y.prototype = Object.create(f.prototype)),
				(y.prototype.fn = function (t, e, r) {
					for (; t > 127; ) ((e[r++] = (127 & t) | 128), (t >>>= 7));
					e[r] = t;
				}),
				(a.prototype.uint32 = function (t) {
					return (
						(this.len += (this.tail = this.tail.next =
							new y(
								(t >>>= 0) < 128
									? 1
									: t < 16384
										? 2
										: t < 2097152
											? 3
											: t < 268435456
												? 4
												: 5,
								t
							)).len),
						this
					);
				}),
				(a.prototype.int32 = function (t) {
					return t < 0 ? this._push(d, 10, i.fromNumber(t)) : this.uint32(t);
				}),
				(a.prototype.sint32 = function (t) {
					return this.uint32(((t << 1) ^ (t >> 31)) >>> 0);
				}),
				(a.prototype.uint64 = function (t) {
					var e = i.from(t);
					return this._push(d, e.length(), e);
				}),
				(a.prototype.int64 = a.prototype.uint64),
				(a.prototype.sint64 = function (t) {
					var e = i.from(t).zzEncode();
					return this._push(d, e.length(), e);
				}),
				(a.prototype.bool = function (t) {
					return this._push(h, 1, t ? 1 : 0);
				}),
				(a.prototype.fixed32 = function (t) {
					return this._push(b, 4, t >>> 0);
				}),
				(a.prototype.sfixed32 = a.prototype.fixed32),
				(a.prototype.fixed64 = function (t) {
					var e = i.from(t);
					return this._push(b, 4, e.lo)._push(b, 4, e.hi);
				}),
				(a.prototype.sfixed64 = a.prototype.fixed64),
				(a.prototype.float = function (t) {
					return this._push(o.float.writeFloatLE, 4, t);
				}),
				(a.prototype.double = function (t) {
					return this._push(o.float.writeDoubleLE, 8, t);
				}));
			var g = o.Array.prototype.set
				? function (t, e, r) {
						e.set(t, r);
					}
				: function (t, e, r) {
						for (var n = 0; n < t.length; ++n) e[r + n] = t[n];
					};
			((a.prototype.bytes = function (t) {
				var e = t.length >>> 0;
				if (!e) return this._push(h, 1, 0);
				if (o.isString(t)) {
					var r = a.alloc((e = s.length(t)));
					(s.decode(t, r, 0), (t = r));
				}
				return this.uint32(e)._push(g, e, t);
			}),
				(a.prototype.string = function (t) {
					var e = u.length(t);
					return e ? this.uint32(e)._push(u.write, e, t) : this._push(h, 1, 0);
				}),
				(a.prototype.fork = function () {
					return (
						(this.states = new c(this)),
						(this.head = this.tail = new f(l, 0, 0)),
						(this.len = 0),
						this
					);
				}),
				(a.prototype.reset = function () {
					return (
						this.states
							? ((this.head = this.states.head),
								(this.tail = this.states.tail),
								(this.len = this.states.len),
								(this.states = this.states.next))
							: ((this.head = this.tail = new f(l, 0, 0)), (this.len = 0)),
						this
					);
				}),
				(a.prototype.ldelim = function () {
					var t = this.head,
						e = this.tail,
						r = this.len;
					return (
						this.reset().uint32(r),
						r && ((this.tail.next = t.next), (this.tail = e), (this.len += r)),
						this
					);
				}),
				(a.prototype.finish = function () {
					for (var t = this.head.next, e = this.constructor.alloc(this.len), r = 0; t; )
						(t.fn(t.val, e, r), (r += t.len), (t = t.next));
					return e;
				}),
				(a._configure = function (t) {
					((n = t), (a.create = p()), n._configure());
				}));
		},
		7159: function (t, e, r) {
			'use strict';
			t.exports = i;
			var n = r(9687);
			(i.prototype = Object.create(n.prototype)).constructor = i;
			var o = r(7067);
			function i() {
				n.call(this);
			}
			function s(t, e, r) {
				t.length < 40
					? o.utf8.write(t, e, r)
					: e.utf8Write
						? e.utf8Write(t, r)
						: e.write(t, r);
			}
			((i._configure = function () {
				((i.alloc = o._Buffer_allocUnsafe),
					(i.writeBytesBuffer =
						o.Buffer &&
						o.Buffer.prototype instanceof Uint8Array &&
						'set' === o.Buffer.prototype.set.name
							? function (t, e, r) {
									e.set(t, r);
								}
							: function (t, e, r) {
									if (t.copy) t.copy(e, r, 0, t.length);
									else for (var n = 0; n < t.length; ) e[r++] = t[n++];
								}));
			}),
				(i.prototype.bytes = function (t) {
					o.isString(t) && (t = o._Buffer_from(t, 'base64'));
					var e = t.length >>> 0;
					return (this.uint32(e), e && this._push(i.writeBytesBuffer, e, t), this);
				}),
				(i.prototype.string = function (t) {
					var e = o.Buffer.byteLength(t);
					return (this.uint32(e), e && this._push(s, e, t), this);
				}),
				i._configure());
		}
	}
]);
