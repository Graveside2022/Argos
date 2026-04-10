/*! For license information please see 69.f4633b9d.chunk.js.LICENSE.txt */
!(function () {
	'use strict';
	var e = {
			2069: function (e, t, r) {
				var n,
					o,
					i,
					a,
					c,
					u,
					s = r(4795),
					l = r(6666),
					f = r(3872);
				function h() {
					h = function () {
						return e;
					};
					var e = {},
						t = Object.prototype,
						r = t.hasOwnProperty,
						n = 'function' == typeof Symbol ? Symbol : {},
						o = n.iterator || '@@iterator',
						i = n.asyncIterator || '@@asyncIterator',
						a = n.toStringTag || '@@toStringTag';
					function c(e, t, r) {
						return (
							Object.defineProperty(e, t, {
								value: r,
								enumerable: !0,
								configurable: !0,
								writable: !0
							}),
							e[t]
						);
					}
					try {
						c({}, '');
					} catch (G) {
						c = function (e, t, r) {
							return (e[t] = r);
						};
					}
					function u(e, t, r, n) {
						var o = t && t.prototype instanceof f ? t : f,
							i = Object.create(o.prototype),
							a = new O(n || []);
						return (
							(i._invoke = (function (e, t, r) {
								var n = 'suspendedStart';
								return function (o, i) {
									if ('executing' === n)
										throw new Error('Generator is already running');
									if ('completed' === n) {
										if ('throw' === o) throw i;
										return P();
									}
									for (r.method = o, r.arg = i; ; ) {
										var a = r.delegate;
										if (a) {
											var c = b(a, r);
											if (c) {
												if (c === l) continue;
												return c;
											}
										}
										if ('next' === r.method) r.sent = r._sent = r.arg;
										else if ('throw' === r.method) {
											if ('suspendedStart' === n)
												throw ((n = 'completed'), r.arg);
											r.dispatchException(r.arg);
										} else 'return' === r.method && r.abrupt('return', r.arg);
										n = 'executing';
										var u = s(e, t, r);
										if ('normal' === u.type) {
											if (
												((n = r.done ? 'completed' : 'suspendedYield'),
												u.arg === l)
											)
												continue;
											return { value: u.arg, done: r.done };
										}
										'throw' === u.type &&
											((n = 'completed'),
											(r.method = 'throw'),
											(r.arg = u.arg));
									}
								};
							})(e, r, a)),
							i
						);
					}
					function s(e, t, r) {
						try {
							return { type: 'normal', arg: e.call(t, r) };
						} catch (G) {
							return { type: 'throw', arg: G };
						}
					}
					e.wrap = u;
					var l = {};
					function f() {}
					function p() {}
					function d() {}
					var g = {};
					c(g, o, function () {
						return this;
					});
					var v = Object.getPrototypeOf,
						y = v && v(v(x([])));
					y && y !== t && r.call(y, o) && (g = y);
					var m = (d.prototype = f.prototype = Object.create(g));
					function w(e) {
						['next', 'throw', 'return'].forEach(function (t) {
							c(e, t, function (e) {
								return this._invoke(t, e);
							});
						});
					}
					function E(e, t) {
						function n(o, i, a, c) {
							var u = s(e[o], e, i);
							if ('throw' !== u.type) {
								var l = u.arg,
									f = l.value;
								return f && 'object' == typeof f && r.call(f, '__await')
									? t.resolve(f.__await).then(
											function (e) {
												n('next', e, a, c);
											},
											function (e) {
												n('throw', e, a, c);
											}
										)
									: t.resolve(f).then(
											function (e) {
												((l.value = e), a(l));
											},
											function (e) {
												return n('throw', e, a, c);
											}
										);
							}
							c(u.arg);
						}
						var o;
						this._invoke = function (e, r) {
							function i() {
								return new t(function (t, o) {
									n(e, r, t, o);
								});
							}
							return (o = o ? o.then(i, i) : i());
						};
					}
					function b(e, t) {
						var r = e.iterator[t.method];
						if (void 0 === r) {
							if (((t.delegate = null), 'throw' === t.method)) {
								if (
									e.iterator.return &&
									((t.method = 'return'),
									(t.arg = void 0),
									b(e, t),
									'throw' === t.method)
								)
									return l;
								((t.method = 'throw'),
									(t.arg = new TypeError(
										"The iterator does not provide a 'throw' method"
									)));
							}
							return l;
						}
						var n = s(r, e.iterator, t.arg);
						if ('throw' === n.type)
							return ((t.method = 'throw'), (t.arg = n.arg), (t.delegate = null), l);
						var o = n.arg;
						return o
							? o.done
								? ((t[e.resultName] = o.value),
									(t.next = e.nextLoc),
									'return' !== t.method &&
										((t.method = 'next'), (t.arg = void 0)),
									(t.delegate = null),
									l)
								: o
							: ((t.method = 'throw'),
								(t.arg = new TypeError('iterator result is not an object')),
								(t.delegate = null),
								l);
					}
					function S(e) {
						var t = { tryLoc: e[0] };
						(1 in e && (t.catchLoc = e[1]),
							2 in e && ((t.finallyLoc = e[2]), (t.afterLoc = e[3])),
							this.tryEntries.push(t));
					}
					function _(e) {
						var t = e.completion || {};
						((t.type = 'normal'), delete t.arg, (e.completion = t));
					}
					function O(e) {
						((this.tryEntries = [{ tryLoc: 'root' }]),
							e.forEach(S, this),
							this.reset(!0));
					}
					function x(e) {
						if (e) {
							var t = e[o];
							if (t) return t.call(e);
							if ('function' == typeof e.next) return e;
							if (!isNaN(e.length)) {
								var n = -1,
									i = function t() {
										for (; ++n < e.length; )
											if (r.call(e, n))
												return ((t.value = e[n]), (t.done = !1), t);
										return ((t.value = void 0), (t.done = !0), t);
									};
								return (i.next = i);
							}
						}
						return { next: P };
					}
					function P() {
						return { value: void 0, done: !0 };
					}
					return (
						(p.prototype = d),
						c(m, 'constructor', d),
						c(d, 'constructor', p),
						(p.displayName = c(d, a, 'GeneratorFunction')),
						(e.isGeneratorFunction = function (e) {
							var t = 'function' == typeof e && e.constructor;
							return (
								!!t &&
								(t === p || 'GeneratorFunction' === (t.displayName || t.name))
							);
						}),
						(e.mark = function (e) {
							return (
								Object.setPrototypeOf
									? Object.setPrototypeOf(e, d)
									: ((e.__proto__ = d), c(e, a, 'GeneratorFunction')),
								(e.prototype = Object.create(m)),
								e
							);
						}),
						(e.awrap = function (e) {
							return { __await: e };
						}),
						w(E.prototype),
						c(E.prototype, i, function () {
							return this;
						}),
						(e.AsyncIterator = E),
						(e.async = function (t, r, n, o, i) {
							void 0 === i && (i = Promise);
							var a = new E(u(t, r, n, o), i);
							return e.isGeneratorFunction(r)
								? a
								: a.next().then(function (e) {
										return e.done ? e.value : a.next();
									});
						}),
						w(m),
						c(m, a, 'Generator'),
						c(m, o, function () {
							return this;
						}),
						c(m, 'toString', function () {
							return '[object Generator]';
						}),
						(e.keys = function (e) {
							var t = [];
							for (var r in e) t.push(r);
							return (
								t.reverse(),
								function r() {
									for (; t.length; ) {
										var n = t.pop();
										if (n in e) return ((r.value = n), (r.done = !1), r);
									}
									return ((r.done = !0), r);
								}
							);
						}),
						(e.values = x),
						(O.prototype = {
							constructor: O,
							reset: function (e) {
								if (
									((this.prev = 0),
									(this.next = 0),
									(this.sent = this._sent = void 0),
									(this.done = !1),
									(this.delegate = null),
									(this.method = 'next'),
									(this.arg = void 0),
									this.tryEntries.forEach(_),
									!e)
								)
									for (var t in this)
										't' === t.charAt(0) &&
											r.call(this, t) &&
											!isNaN(+t.slice(1)) &&
											(this[t] = void 0);
							},
							stop: function () {
								this.done = !0;
								var e = this.tryEntries[0].completion;
								if ('throw' === e.type) throw e.arg;
								return this.rval;
							},
							dispatchException: function (e) {
								if (this.done) throw e;
								var t = this;
								function n(r, n) {
									return (
										(a.type = 'throw'),
										(a.arg = e),
										(t.next = r),
										n && ((t.method = 'next'), (t.arg = void 0)),
										!!n
									);
								}
								for (var o = this.tryEntries.length - 1; o >= 0; --o) {
									var i = this.tryEntries[o],
										a = i.completion;
									if ('root' === i.tryLoc) return n('end');
									if (i.tryLoc <= this.prev) {
										var c = r.call(i, 'catchLoc'),
											u = r.call(i, 'finallyLoc');
										if (c && u) {
											if (this.prev < i.catchLoc) return n(i.catchLoc, !0);
											if (this.prev < i.finallyLoc) return n(i.finallyLoc);
										} else if (c) {
											if (this.prev < i.catchLoc) return n(i.catchLoc, !0);
										} else {
											if (!u)
												throw new Error(
													'try statement without catch or finally'
												);
											if (this.prev < i.finallyLoc) return n(i.finallyLoc);
										}
									}
								}
							},
							abrupt: function (e, t) {
								for (var n = this.tryEntries.length - 1; n >= 0; --n) {
									var o = this.tryEntries[n];
									if (
										o.tryLoc <= this.prev &&
										r.call(o, 'finallyLoc') &&
										this.prev < o.finallyLoc
									) {
										var i = o;
										break;
									}
								}
								i &&
									('break' === e || 'continue' === e) &&
									i.tryLoc <= t &&
									t <= i.finallyLoc &&
									(i = null);
								var a = i ? i.completion : {};
								return (
									(a.type = e),
									(a.arg = t),
									i
										? ((this.method = 'next'), (this.next = i.finallyLoc), l)
										: this.complete(a)
								);
							},
							complete: function (e, t) {
								if ('throw' === e.type) throw e.arg;
								return (
									'break' === e.type || 'continue' === e.type
										? (this.next = e.arg)
										: 'return' === e.type
											? ((this.rval = this.arg = e.arg),
												(this.method = 'return'),
												(this.next = 'end'))
											: 'normal' === e.type && t && (this.next = t),
									l
								);
							},
							finish: function (e) {
								for (var t = this.tryEntries.length - 1; t >= 0; --t) {
									var r = this.tryEntries[t];
									if (r.finallyLoc === e)
										return (this.complete(r.completion, r.afterLoc), _(r), l);
								}
							},
							catch: function (e) {
								for (var t = this.tryEntries.length - 1; t >= 0; --t) {
									var r = this.tryEntries[t];
									if (r.tryLoc === e) {
										var n = r.completion;
										if ('throw' === n.type) {
											var o = n.arg;
											_(r);
										}
										return o;
									}
								}
								throw new Error('illegal catch attempt');
							},
							delegateYield: function (e, t, r) {
								return (
									(this.delegate = { iterator: x(e), resultName: t, nextLoc: r }),
									'next' === this.method && (this.arg = void 0),
									l
								);
							}
						}),
						e
					);
				}
				(!(function (e) {
					((e[(e.GetAllEvents = 0)] = 'GetAllEvents'),
						(e[(e.RemoveEvents = 1)] = 'RemoveEvents'),
						(e[(e.SaveEvents = 2)] = 'SaveEvents'));
				})(n || (n = {})),
					(function (e) {
						((e[(e.Connect = 0)] = 'Connect'),
							(e[(e.Disconnect = 1)] = 'Disconnect'),
							(e[(e.SetSocketUrl = 2)] = 'SetSocketUrl'),
							(e[(e.OnSocketConnect = 3)] = 'OnSocketConnect'),
							(e[(e.OnSocketDisconnect = 4)] = 'OnSocketDisconnect'),
							(e[(e.OnSocketError = 5)] = 'OnSocketError'),
							(e[(e.OnSocketMessage = 6)] = 'OnSocketMessage'),
							(e[(e.SendMessage = 7)] = 'SendMessage'));
					})(o || (o = {})),
					(function (e) {
						((e[(e.DeleteMessages = 0)] = 'DeleteMessages'),
							(e[(e.GetAllMessages = 1)] = 'GetAllMessages'),
							(e[(e.SaveMessages = 2)] = 'SaveMessages'));
					})(i || (i = {})),
					(function (e) {
						((e[(e.UnzipFile = 0)] = 'UnzipFile'),
							(e[(e.GetAllDataPackages = 1)] = 'GetAllDataPackages'),
							(e[(e.ProcessNewDataPackage = 2)] = 'ProcessNewDataPackage'),
							(e[(e.ToggleDataPackageEnabled = 3)] = 'ToggleDataPackageEnabled'),
							(e[(e.UpdateDataPackage = 4)] = 'UpdateDataPackage'),
							(e[(e.DeleteDataPackage = 5)] = 'DeleteDataPackage'));
					})(a || (a = {})),
					(function (e) {
						((e[(e.GetWkt = 0)] = 'GetWkt'),
							(e[(e.LoadTiff = 1)] = 'LoadTiff'),
							(e[(e.LoadItems = 2)] = 'LoadItems'));
					})(c || (c = {})),
					(function (e) {
						((e[(e.AddFile = 0)] = 'AddFile'),
							(e[(e.GetAllFiles = 1)] = 'GetAllFiles'),
							(e[(e.GetFile = 2)] = 'GetFile'),
							(e[(e.RemoveFile = 3)] = 'RemoveFile'),
							(e[(e.UpdateFile = 4)] = 'UpdateFile'));
					})(u || (u = {})),
					(onmessage = function (e) {
						var t,
							r = e.data,
							n = r.mode,
							o = r.payload,
							i = ((t = {}), (0, l.Z)(t, c.GetWkt, g), (0, l.Z)(t, c.LoadTiff, y), t)[
								n
							];
						i && i(o);
					}));
				var p = {
						3857: 'PROJCS["WGS_1984_Web_Mercator_Auxiliary_Sphere",GEOGCS["GCS_WGS_1984",DATUM["D_WGS_1984",SPHEROID["WGS_1984",6378137.0,298.257223563]],PRIMEM["Greenwich",0.0],UNIT["Degree",0.0174532925199433]],PROJECTION["Mercator_Auxiliary_Sphere"],PARAMETER["False_Easting",0.0],PARAMETER["False_Northing",0.0],PARAMETER["Central_Meridian",0.0],PARAMETER["Standard_Parallel_1",0.0],PARAMETER["Auxiliary_Sphere_Type",0.0],UNIT["Meter",1.0],AUTHORITY["EPSG",3857]]',
						4326: 'GEOGCS["GCS_WGS_1984",DATUM["D_WGS_1984",SPHEROID["WGS_1984",6378137.0,298.257223563]],PRIMEM["Greenwich",0.0],UNIT["Degree",0.0174532925199433],AUTHORITY["EPSG",4326]]',
						32615: 'PROJCS["WGS_1984_UTM_Zone_15N",GEOGCS["GCS_WGS_1984",DATUM["D_WGS_1984",SPHEROID["WGS_1984",6378137.0,298.257223563]],PRIMEM["Greenwich",0.0],UNIT["Degree",0.0174532925199433]],PROJECTION["Transverse_Mercator"],PARAMETER["False_Easting",500000.0],PARAMETER["False_Northing",0.0],PARAMETER["Central_Meridian",-93.0],PARAMETER["Scale_Factor",0.9996],PARAMETER["Latitude_Of_Origin",0.0],UNIT["Meter",1.0],AUTHORITY["EPSG",32615]]'
					},
					d = void 0;
				function g(e) {
					return v.apply(this, arguments);
				}
				function v() {
					return (v = (0, s.Z)(
						h().mark(function e(t) {
							var r, n, o, i, a;
							return h().wrap(function (e) {
								for (;;)
									switch ((e.prev = e.next)) {
										case 0:
											if (
												((n = (r = t).epsgCode),
												(o = r.webtakRootUrl),
												(i = { mode: c.GetWkt, payload: void 0 }),
												!p[n])
											) {
												e.next = 6;
												break;
											}
											return (
												(i.payload = p[n]),
												postMessage(i),
												e.abrupt('return')
											);
										case 6:
											if (d) {
												e.next = 13;
												break;
											}
											return (
												(a = ''.concat(
													o,
													'resources/map-assets/wkts.json'
												)),
												(e.next = 10),
												fetch(a)
											);
										case 10:
											return ((e.next = 12), e.sent.json());
										case 12:
											d = e.sent;
										case 13:
											if (!d[n]) {
												e.next = 17;
												break;
											}
											return (
												(i.payload = d[n]),
												postMessage(i),
												e.abrupt('return')
											);
										case 17:
											return (postMessage(i), e.abrupt('return'));
										case 19:
										case 'end':
											return e.stop();
									}
							}, e);
						})
					)).apply(this, arguments);
				}
				function y(e) {
					return m.apply(this, arguments);
				}
				function m() {
					return (m = (0, s.Z)(
						h().mark(function e(t) {
							var r, n, o, i, a, u, s, l, p, d, g, v, y, m;
							return h().wrap(function (e) {
								for (;;)
									switch ((e.prev = e.next)) {
										case 0:
											return ((r = t), (e.next = 3), f.go(r));
										case 3:
											return ((n = e.sent), (e.next = 6), n.getImage(0));
										case 6:
											return (
												(o = e.sent),
												(i = o.getBoundingBox()),
												(a = o.getFileDirectory()),
												(u = a && 4 === a.SamplesPerPixel),
												(e.next = 12),
												o.readRGB({ enableAlpha: u })
											);
										case 12:
											for (
												s = e.sent,
													l = s.width,
													p = s.height,
													d = new Uint8ClampedArray(l * p * 4),
													g = 0,
													v = 0,
													s instanceof Uint16Array && (v = 8),
													y = 0;
												y < s.length;
												y += u ? 4 : 3
											)
												((d[g] = s[y] >> v),
													(d[g + 1] = s[y + 1] >> v),
													(d[g + 2] = s[y + 2] >> v),
													(d[g + 3] =
														s[y] || s[y + 1] || s[y + 2] ? 255 : 0),
													u && (d[g + 3] = s[y + 3] ? s[y + 3] >> v : 0),
													(g += 4));
											((m = {
												mode: c.LoadItems,
												payload: {
													geoKeys: o.geoKeys,
													data: d,
													imageSize: { width: l, height: p },
													boundingBox: i
												}
											}),
												postMessage(m));
										case 21:
										case 'end':
											return e.stop();
									}
							}, e);
						})
					)).apply(this, arguments);
				}
			}
		},
		t = {};
	function r(n) {
		var o = t[n];
		if (void 0 !== o) return o.exports;
		var i = (t[n] = { exports: {} });
		return (e[n](i, i.exports, r), i.exports);
	}
	((r.m = e),
		(r.x = function () {
			var e = r.O(void 0, [361], function () {
				return r(2069);
			});
			return (e = r.O(e));
		}),
		(function () {
			var e = [];
			r.O = function (t, n, o, i) {
				if (!n) {
					var a = 1 / 0;
					for (l = 0; l < e.length; l++) {
						((n = e[l][0]), (o = e[l][1]), (i = e[l][2]));
						for (var c = !0, u = 0; u < n.length; u++)
							(!1 & i || a >= i) &&
							Object.keys(r.O).every(function (e) {
								return r.O[e](n[u]);
							})
								? n.splice(u--, 1)
								: ((c = !1), i < a && (a = i));
						if (c) {
							e.splice(l--, 1);
							var s = o();
							void 0 !== s && (t = s);
						}
					}
					return t;
				}
				i = i || 0;
				for (var l = e.length; l > 0 && e[l - 1][2] > i; l--) e[l] = e[l - 1];
				e[l] = [n, o, i];
			};
		})(),
		(r.d = function (e, t) {
			for (var n in t)
				r.o(t, n) &&
					!r.o(e, n) &&
					Object.defineProperty(e, n, { enumerable: !0, get: t[n] });
		}),
		(r.f = {}),
		(r.e = function (e) {
			return Promise.all(
				Object.keys(r.f).reduce(function (t, n) {
					return (r.f[n](e, t), t);
				}, [])
			);
		}),
		(r.u = function (e) {
			return (
				'static/js/' +
				e +
				'.' +
				{
					361: 'eb4dbaf2',
					379: '98ffc9d8',
					425: 'c76647f0',
					559: '773ee528',
					592: 'b150b097',
					762: '6160ed18',
					787: '6d0a7299',
					943: '1f401fb1',
					981: '65b7b944'
				}[e] +
				'.chunk.js'
			);
		}),
		(r.miniCssF = function (e) {}),
		(r.g = (function () {
			if ('object' === typeof globalThis) return globalThis;
			try {
				return this || new Function('return this')();
			} catch (e) {
				if ('object' === typeof window) return window;
			}
		})()),
		(r.o = function (e, t) {
			return Object.prototype.hasOwnProperty.call(e, t);
		}),
		(r.r = function (e) {
			('undefined' !== typeof Symbol &&
				Symbol.toStringTag &&
				Object.defineProperty(e, Symbol.toStringTag, { value: 'Module' }),
				Object.defineProperty(e, '__esModule', { value: !0 }));
		}),
		(function () {
			var e;
			r.g.importScripts && (e = r.g.location + '');
			var t = r.g.document;
			if (!e && t && (t.currentScript && (e = t.currentScript.src), !e)) {
				var n = t.getElementsByTagName('script');
				n.length && (e = n[n.length - 1].src);
			}
			if (!e) throw new Error('Automatic publicPath is not supported in this browser');
			((e = e
				.replace(/#.*$/, '')
				.replace(/\?.*$/, '')
				.replace(/\/[^\/]+$/, '/')),
				(r.p = e + '../../'));
		})(),
		(function () {
			var e = { 69: 1 };
			r.f.i = function (t, n) {
				e[t] || importScripts(r.p + r.u(t));
			};
			var t = (Object(
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
				n = t.push.bind(t);
			t.push = function (t) {
				var o = t[0],
					i = t[1],
					a = t[2];
				for (var c in i) r.o(i, c) && (r.m[c] = i[c]);
				for (a && a(r); o.length; ) e[o.pop()] = 1;
				n(t);
			};
		})(),
		(function () {
			var e = r.x;
			r.x = function () {
				return r.e(361).then(e);
			};
		})());
	r.x();
})();
