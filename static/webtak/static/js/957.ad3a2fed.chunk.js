/*! For license information please see 957.ad3a2fed.chunk.js.LICENSE.txt */
!(function () {
	'use strict';
	var t = {
			2957: function (t, e, n) {
				var r,
					a,
					o,
					i,
					c,
					s,
					u,
					f,
					l = n(1361),
					p = n(3028),
					h = n(4795),
					d = n(6666),
					v = n(2589),
					y = 'wt-core';
				function g() {
					g = function () {
						return t;
					};
					var t = {},
						e = Object.prototype,
						n = e.hasOwnProperty,
						r = 'function' == typeof Symbol ? Symbol : {},
						a = r.iterator || '@@iterator',
						o = r.asyncIterator || '@@asyncIterator',
						i = r.toStringTag || '@@toStringTag';
					function c(t, e, n) {
						return (
							Object.defineProperty(t, e, {
								value: n,
								enumerable: !0,
								configurable: !0,
								writable: !0
							}),
							t[e]
						);
					}
					try {
						c({}, '');
					} catch (F) {
						c = function (t, e, n) {
							return (t[e] = n);
						};
					}
					function s(t, e, n, r) {
						var a = e && e.prototype instanceof l ? e : l,
							o = Object.create(a.prototype),
							i = new S(r || []);
						return (
							(o._invoke = (function (t, e, n) {
								var r = 'suspendedStart';
								return function (a, o) {
									if ('executing' === r)
										throw new Error('Generator is already running');
									if ('completed' === r) {
										if ('throw' === a) throw o;
										return L();
									}
									for (n.method = a, n.arg = o; ; ) {
										var i = n.delegate;
										if (i) {
											var c = b(i, n);
											if (c) {
												if (c === f) continue;
												return c;
											}
										}
										if ('next' === n.method) n.sent = n._sent = n.arg;
										else if ('throw' === n.method) {
											if ('suspendedStart' === r)
												throw ((r = 'completed'), n.arg);
											n.dispatchException(n.arg);
										} else 'return' === n.method && n.abrupt('return', n.arg);
										r = 'executing';
										var s = u(t, e, n);
										if ('normal' === s.type) {
											if (
												((r = n.done ? 'completed' : 'suspendedYield'),
												s.arg === f)
											)
												continue;
											return { value: s.arg, done: n.done };
										}
										'throw' === s.type &&
											((r = 'completed'),
											(n.method = 'throw'),
											(n.arg = s.arg));
									}
								};
							})(t, n, i)),
							o
						);
					}
					function u(t, e, n) {
						try {
							return { type: 'normal', arg: t.call(e, n) };
						} catch (F) {
							return { type: 'throw', arg: F };
						}
					}
					t.wrap = s;
					var f = {};
					function l() {}
					function p() {}
					function h() {}
					var d = {};
					c(d, a, function () {
						return this;
					});
					var v = Object.getPrototypeOf,
						y = v && v(v(O([])));
					y && y !== e && n.call(y, a) && (d = y);
					var m = (h.prototype = l.prototype = Object.create(d));
					function w(t) {
						['next', 'throw', 'return'].forEach(function (e) {
							c(t, e, function (t) {
								return this._invoke(e, t);
							});
						});
					}
					function x(t, e) {
						function r(a, o, i, c) {
							var s = u(t[a], t, o);
							if ('throw' !== s.type) {
								var f = s.arg,
									l = f.value;
								return l && 'object' == typeof l && n.call(l, '__await')
									? e.resolve(l.__await).then(
											function (t) {
												r('next', t, i, c);
											},
											function (t) {
												r('throw', t, i, c);
											}
										)
									: e.resolve(l).then(
											function (t) {
												((f.value = t), i(f));
											},
											function (t) {
												return r('throw', t, i, c);
											}
										);
							}
							c(s.arg);
						}
						var a;
						this._invoke = function (t, n) {
							function o() {
								return new e(function (e, a) {
									r(t, n, e, a);
								});
							}
							return (a = a ? a.then(o, o) : o());
						};
					}
					function b(t, e) {
						var n = t.iterator[e.method];
						if (void 0 === n) {
							if (((e.delegate = null), 'throw' === e.method)) {
								if (
									t.iterator.return &&
									((e.method = 'return'),
									(e.arg = void 0),
									b(t, e),
									'throw' === e.method)
								)
									return f;
								((e.method = 'throw'),
									(e.arg = new TypeError(
										"The iterator does not provide a 'throw' method"
									)));
							}
							return f;
						}
						var r = u(n, t.iterator, e.arg);
						if ('throw' === r.type)
							return ((e.method = 'throw'), (e.arg = r.arg), (e.delegate = null), f);
						var a = r.arg;
						return a
							? a.done
								? ((e[t.resultName] = a.value),
									(e.next = t.nextLoc),
									'return' !== e.method &&
										((e.method = 'next'), (e.arg = void 0)),
									(e.delegate = null),
									f)
								: a
							: ((e.method = 'throw'),
								(e.arg = new TypeError('iterator result is not an object')),
								(e.delegate = null),
								f);
					}
					function k(t) {
						var e = { tryLoc: t[0] };
						(1 in t && (e.catchLoc = t[1]),
							2 in t && ((e.finallyLoc = t[2]), (e.afterLoc = t[3])),
							this.tryEntries.push(e));
					}
					function E(t) {
						var e = t.completion || {};
						((e.type = 'normal'), delete e.arg, (t.completion = e));
					}
					function S(t) {
						((this.tryEntries = [{ tryLoc: 'root' }]),
							t.forEach(k, this),
							this.reset(!0));
					}
					function O(t) {
						if (t) {
							var e = t[a];
							if (e) return e.call(t);
							if ('function' == typeof t.next) return t;
							if (!isNaN(t.length)) {
								var r = -1,
									o = function e() {
										for (; ++r < t.length; )
											if (n.call(t, r))
												return ((e.value = t[r]), (e.done = !1), e);
										return ((e.value = void 0), (e.done = !0), e);
									};
								return (o.next = o);
							}
						}
						return { next: L };
					}
					function L() {
						return { value: void 0, done: !0 };
					}
					return (
						(p.prototype = h),
						c(m, 'constructor', h),
						c(h, 'constructor', p),
						(p.displayName = c(h, i, 'GeneratorFunction')),
						(t.isGeneratorFunction = function (t) {
							var e = 'function' == typeof t && t.constructor;
							return (
								!!e &&
								(e === p || 'GeneratorFunction' === (e.displayName || e.name))
							);
						}),
						(t.mark = function (t) {
							return (
								Object.setPrototypeOf
									? Object.setPrototypeOf(t, h)
									: ((t.__proto__ = h), c(t, i, 'GeneratorFunction')),
								(t.prototype = Object.create(m)),
								t
							);
						}),
						(t.awrap = function (t) {
							return { __await: t };
						}),
						w(x.prototype),
						c(x.prototype, o, function () {
							return this;
						}),
						(t.AsyncIterator = x),
						(t.async = function (e, n, r, a, o) {
							void 0 === o && (o = Promise);
							var i = new x(s(e, n, r, a), o);
							return t.isGeneratorFunction(n)
								? i
								: i.next().then(function (t) {
										return t.done ? t.value : i.next();
									});
						}),
						w(m),
						c(m, i, 'Generator'),
						c(m, a, function () {
							return this;
						}),
						c(m, 'toString', function () {
							return '[object Generator]';
						}),
						(t.keys = function (t) {
							var e = [];
							for (var n in t) e.push(n);
							return (
								e.reverse(),
								function n() {
									for (; e.length; ) {
										var r = e.pop();
										if (r in t) return ((n.value = r), (n.done = !1), n);
									}
									return ((n.done = !0), n);
								}
							);
						}),
						(t.values = O),
						(S.prototype = {
							constructor: S,
							reset: function (t) {
								if (
									((this.prev = 0),
									(this.next = 0),
									(this.sent = this._sent = void 0),
									(this.done = !1),
									(this.delegate = null),
									(this.method = 'next'),
									(this.arg = void 0),
									this.tryEntries.forEach(E),
									!t)
								)
									for (var e in this)
										't' === e.charAt(0) &&
											n.call(this, e) &&
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
								function r(n, r) {
									return (
										(i.type = 'throw'),
										(i.arg = t),
										(e.next = n),
										r && ((e.method = 'next'), (e.arg = void 0)),
										!!r
									);
								}
								for (var a = this.tryEntries.length - 1; a >= 0; --a) {
									var o = this.tryEntries[a],
										i = o.completion;
									if ('root' === o.tryLoc) return r('end');
									if (o.tryLoc <= this.prev) {
										var c = n.call(o, 'catchLoc'),
											s = n.call(o, 'finallyLoc');
										if (c && s) {
											if (this.prev < o.catchLoc) return r(o.catchLoc, !0);
											if (this.prev < o.finallyLoc) return r(o.finallyLoc);
										} else if (c) {
											if (this.prev < o.catchLoc) return r(o.catchLoc, !0);
										} else {
											if (!s)
												throw new Error(
													'try statement without catch or finally'
												);
											if (this.prev < o.finallyLoc) return r(o.finallyLoc);
										}
									}
								}
							},
							abrupt: function (t, e) {
								for (var r = this.tryEntries.length - 1; r >= 0; --r) {
									var a = this.tryEntries[r];
									if (
										a.tryLoc <= this.prev &&
										n.call(a, 'finallyLoc') &&
										this.prev < a.finallyLoc
									) {
										var o = a;
										break;
									}
								}
								o &&
									('break' === t || 'continue' === t) &&
									o.tryLoc <= e &&
									e <= o.finallyLoc &&
									(o = null);
								var i = o ? o.completion : {};
								return (
									(i.type = t),
									(i.arg = e),
									o
										? ((this.method = 'next'), (this.next = o.finallyLoc), f)
										: this.complete(i)
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
									f
								);
							},
							finish: function (t) {
								for (var e = this.tryEntries.length - 1; e >= 0; --e) {
									var n = this.tryEntries[e];
									if (n.finallyLoc === t)
										return (this.complete(n.completion, n.afterLoc), E(n), f);
								}
							},
							catch: function (t) {
								for (var e = this.tryEntries.length - 1; e >= 0; --e) {
									var n = this.tryEntries[e];
									if (n.tryLoc === t) {
										var r = n.completion;
										if ('throw' === r.type) {
											var a = r.arg;
											E(n);
										}
										return a;
									}
								}
								throw new Error('illegal catch attempt');
							},
							delegateYield: function (t, e, n) {
								return (
									(this.delegate = { iterator: O(t), resultName: e, nextLoc: n }),
									'next' === this.method && (this.arg = void 0),
									f
								);
							}
						}),
						t
					);
				}
				function m() {
					return w.apply(this, arguments);
				}
				function w() {
					return (w = (0, h.Z)(
						g().mark(function t() {
							return g().wrap(function (t) {
								for (;;)
									switch ((t.prev = t.next)) {
										case 0:
											return ((t.next = 2), (0, v.X3)(y));
										case 2:
											f = t.sent;
										case 3:
										case 'end':
											return t.stop();
									}
							}, t);
						})
					)).apply(this, arguments);
				}
				function x(t) {
					return b.apply(this, arguments);
				}
				function b() {
					return (b = (0, h.Z)(
						g().mark(function t(e) {
							var n, r;
							return g().wrap(function (t) {
								for (;;)
									switch ((t.prev = t.next)) {
										case 0:
											if (f) {
												t.next = 3;
												break;
											}
											return ((t.next = 3), m());
										case 3:
											return (
												(n = e),
												(r = f.transaction(
													['files', 'file-metadata'],
													'readwrite'
												)),
												(t.next = 7),
												f.add('files', n.data, n.uid)
											);
										case 7:
											return (
												(t.next = 9),
												f.add(
													'file-metadata',
													Object.assign({}, n, { data: null })
												)
											);
										case 9:
											r.done;
										case 10:
										case 'end':
											return t.stop();
									}
							}, t);
						})
					)).apply(this, arguments);
				}
				function k(t) {
					return E.apply(this, arguments);
				}
				function E() {
					return (E = (0, h.Z)(
						g().mark(function t(e) {
							var n, r;
							return g().wrap(function (t) {
								for (;;)
									switch ((t.prev = t.next)) {
										case 0:
											if (f) {
												t.next = 3;
												break;
											}
											return ((t.next = 3), m());
										case 3:
											return (
												(n = e),
												(r = f.transaction(
													['files', 'file-metadata'],
													'readwrite'
												)),
												(t.next = 7),
												f.put('files', n.data, n.uid)
											);
										case 7:
											return (
												(t.next = 9),
												f.put(
													'file-metadata',
													Object.assign({}, n, { data: null })
												)
											);
										case 9:
											r.done;
										case 10:
										case 'end':
											return t.stop();
									}
							}, t);
						})
					)).apply(this, arguments);
				}
				function S(t) {
					return O.apply(this, arguments);
				}
				function O() {
					return (O = (0, h.Z)(
						g().mark(function t(e) {
							var n, r;
							return g().wrap(function (t) {
								for (;;)
									switch ((t.prev = t.next)) {
										case 0:
											if (f) {
												t.next = 3;
												break;
											}
											return ((t.next = 3), m());
										case 3:
											return (
												(n = e),
												(r = f.transaction(
													['files', 'file-metadata'],
													'readwrite'
												)),
												(t.next = 7),
												f.delete('files', n)
											);
										case 7:
											return (
												t.sent,
												(t.next = 10),
												f.delete('file-metadata', n)
											);
										case 10:
											(t.sent, r.done);
										case 12:
										case 'end':
											return t.stop();
									}
							}, t);
						})
					)).apply(this, arguments);
				}
				function L(t) {
					return F.apply(this, arguments);
				}
				function F() {
					return (F = (0, h.Z)(
						g().mark(function t(e) {
							var n, r, a, o, i;
							return g().wrap(function (t) {
								for (;;)
									switch ((t.prev = t.next)) {
										case 0:
											if (f) {
												t.next = 3;
												break;
											}
											return ((t.next = 3), m());
										case 3:
											return (
												(n = e),
												(r = f.transaction(
													['files', 'file-metadata'],
													'readonly'
												)),
												(t.next = 7),
												f.get('files', n)
											);
										case 7:
											return (
												(a = t.sent),
												(t.next = 10),
												f.get('file-metadata', n)
											);
										case 10:
											if (
												((o = t.sent),
												r.done,
												(i = { mode: u.GetFile, payload: void 0 }),
												o && a)
											) {
												t.next = 16;
												break;
											}
											return (postMessage(i), t.abrupt('return'));
										case 16:
											return (
												(i.payload = (0, p.Z)(
													(0, p.Z)({}, o),
													{},
													{ data: a }
												)),
												postMessage(i),
												t.abrupt('return')
											);
										case 19:
										case 'end':
											return t.stop();
									}
							}, t);
						})
					)).apply(this, arguments);
				}
				function A(t) {
					return G.apply(this, arguments);
				}
				function G() {
					return (G = (0, h.Z)(
						g().mark(function t(e) {
							var n, r, a, o, i, c, s, h, d;
							return g().wrap(
								function (t) {
									for (;;)
										switch ((t.prev = t.next)) {
											case 0:
												if (f) {
													t.next = 3;
													break;
												}
												return ((t.next = 3), m());
											case 3:
												return (
													(n = e),
													(r = f.transaction(
														['files', 'file-metadata'],
														'readonly'
													)),
													(t.next = 7),
													f.getAll('file-metadata')
												);
											case 7:
												((a = t.sent),
													(o = {}),
													(i = (0, l.Z)(a)),
													(t.prev = 10),
													i.s());
											case 12:
												if ((c = i.n()).done) {
													t.next = 24;
													break;
												}
												if (((s = c.value), !n.includes(s.uid))) {
													t.next = 21;
													break;
												}
												return ((t.next = 17), f.get('files', s.uid));
											case 17:
												((h = t.sent),
													(o[s.uid] = (0, p.Z)(
														(0, p.Z)({}, s),
														{},
														{ data: h }
													)),
													(t.next = 22));
												break;
											case 21:
												o[s.uid] = s;
											case 22:
												t.next = 12;
												break;
											case 24:
												t.next = 29;
												break;
											case 26:
												((t.prev = 26), (t.t0 = t.catch(10)), i.e(t.t0));
											case 29:
												return ((t.prev = 29), i.f(), t.finish(29));
											case 32:
												(r.done,
													(d = { mode: u.GetAllFiles, payload: o }),
													postMessage(d));
											case 35:
											case 'end':
												return t.stop();
										}
								},
								t,
								null,
								[[10, 26, 29, 32]]
							);
						})
					)).apply(this, arguments);
				}
				(!(function (t) {
					((t.FILES = 'files'),
						(t.FILE_METADATA = 'file-metadata'),
						(t.DATA_PACKAGES = 'data-packages'),
						(t.EVENTS = 'events'),
						(t.CHAT_MESSAGES = 'chat-messages'),
						(t.ICONS = 'icons'),
						(t.ICON_SETS = 'icon-sets'));
				})(r || (r = {})),
					(function (t) {
						((t[(t.GetAllEvents = 0)] = 'GetAllEvents'),
							(t[(t.RemoveEvents = 1)] = 'RemoveEvents'),
							(t[(t.SaveEvents = 2)] = 'SaveEvents'));
					})(a || (a = {})),
					(function (t) {
						((t[(t.Connect = 0)] = 'Connect'),
							(t[(t.Disconnect = 1)] = 'Disconnect'),
							(t[(t.SetSocketUrl = 2)] = 'SetSocketUrl'),
							(t[(t.OnSocketConnect = 3)] = 'OnSocketConnect'),
							(t[(t.OnSocketDisconnect = 4)] = 'OnSocketDisconnect'),
							(t[(t.OnSocketError = 5)] = 'OnSocketError'),
							(t[(t.OnSocketMessage = 6)] = 'OnSocketMessage'),
							(t[(t.SendMessage = 7)] = 'SendMessage'));
					})(o || (o = {})),
					(function (t) {
						((t[(t.DeleteMessages = 0)] = 'DeleteMessages'),
							(t[(t.GetAllMessages = 1)] = 'GetAllMessages'),
							(t[(t.SaveMessages = 2)] = 'SaveMessages'));
					})(i || (i = {})),
					(function (t) {
						((t[(t.UnzipFile = 0)] = 'UnzipFile'),
							(t[(t.GetAllDataPackages = 1)] = 'GetAllDataPackages'),
							(t[(t.ProcessNewDataPackage = 2)] = 'ProcessNewDataPackage'),
							(t[(t.ToggleDataPackageEnabled = 3)] = 'ToggleDataPackageEnabled'),
							(t[(t.UpdateDataPackage = 4)] = 'UpdateDataPackage'),
							(t[(t.DeleteDataPackage = 5)] = 'DeleteDataPackage'));
					})(c || (c = {})),
					(function (t) {
						((t[(t.GetWkt = 0)] = 'GetWkt'),
							(t[(t.LoadTiff = 1)] = 'LoadTiff'),
							(t[(t.LoadItems = 2)] = 'LoadItems'));
					})(s || (s = {})),
					(function (t) {
						((t[(t.AddFile = 0)] = 'AddFile'),
							(t[(t.GetAllFiles = 1)] = 'GetAllFiles'),
							(t[(t.GetFile = 2)] = 'GetFile'),
							(t[(t.RemoveFile = 3)] = 'RemoveFile'),
							(t[(t.UpdateFile = 4)] = 'UpdateFile'));
					})(u || (u = {})),
					(onmessage = function (t) {
						var e,
							n = t.data,
							r = n.mode,
							a = n.payload,
							o = ((e = {}),
							(0, d.Z)(e, u.AddFile, x),
							(0, d.Z)(e, u.GetAllFiles, A),
							(0, d.Z)(e, u.GetFile, L),
							(0, d.Z)(e, u.RemoveFile, S),
							(0, d.Z)(e, u.UpdateFile, k),
							e)[r];
						o && o(a);
					}));
			}
		},
		e = {};
	function n(r) {
		var a = e[r];
		if (void 0 !== a) return a.exports;
		var o = (e[r] = { exports: {} });
		return (t[r](o, o.exports, n), o.exports);
	}
	((n.m = t),
		(n.x = function () {
			var t = n.O(void 0, [755], function () {
				return n(2957);
			});
			return (t = n.O(t));
		}),
		(function () {
			var t = [];
			n.O = function (e, r, a, o) {
				if (!r) {
					var i = 1 / 0;
					for (f = 0; f < t.length; f++) {
						((r = t[f][0]), (a = t[f][1]), (o = t[f][2]));
						for (var c = !0, s = 0; s < r.length; s++)
							(!1 & o || i >= o) &&
							Object.keys(n.O).every(function (t) {
								return n.O[t](r[s]);
							})
								? r.splice(s--, 1)
								: ((c = !1), o < i && (i = o));
						if (c) {
							t.splice(f--, 1);
							var u = a();
							void 0 !== u && (e = u);
						}
					}
					return e;
				}
				o = o || 0;
				for (var f = t.length; f > 0 && t[f - 1][2] > o; f--) t[f] = t[f - 1];
				t[f] = [r, a, o];
			};
		})(),
		(n.d = function (t, e) {
			for (var r in e)
				n.o(e, r) &&
					!n.o(t, r) &&
					Object.defineProperty(t, r, { enumerable: !0, get: e[r] });
		}),
		(n.f = {}),
		(n.e = function (t) {
			return Promise.all(
				Object.keys(n.f).reduce(function (e, r) {
					return (n.f[r](t, e), e);
				}, [])
			);
		}),
		(n.u = function (t) {
			return 'static/js/' + t + '.8d15b362.chunk.js';
		}),
		(n.miniCssF = function (t) {}),
		(n.g = (function () {
			if ('object' === typeof globalThis) return globalThis;
			try {
				return this || new Function('return this')();
			} catch (t) {
				if ('object' === typeof window) return window;
			}
		})()),
		(n.o = function (t, e) {
			return Object.prototype.hasOwnProperty.call(t, e);
		}),
		(function () {
			var t;
			n.g.importScripts && (t = n.g.location + '');
			var e = n.g.document;
			if (!t && e && (e.currentScript && (t = e.currentScript.src), !t)) {
				var r = e.getElementsByTagName('script');
				r.length && (t = r[r.length - 1].src);
			}
			if (!t) throw new Error('Automatic publicPath is not supported in this browser');
			((t = t
				.replace(/#.*$/, '')
				.replace(/\?.*$/, '')
				.replace(/\/[^\/]+$/, '/')),
				(n.p = t + '../../'));
		})(),
		(function () {
			var t = { 957: 1 };
			n.f.i = function (e, r) {
				t[e] || importScripts(n.p + n.u(e));
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
				r = e.push.bind(e);
			e.push = function (e) {
				var a = e[0],
					o = e[1],
					i = e[2];
				for (var c in o) n.o(o, c) && (n.m[c] = o[c]);
				for (i && i(n); a.length; ) t[a.pop()] = 1;
				r(e);
			};
		})(),
		(function () {
			var t = n.x;
			n.x = function () {
				return n.e(755).then(t);
			};
		})());
	n.x();
})();
