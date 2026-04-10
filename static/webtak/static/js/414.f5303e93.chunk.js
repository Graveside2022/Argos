/*! For license information please see 414.f5303e93.chunk.js.LICENSE.txt */
!(function () {
	'use strict';
	var t = {
			1414: function (t, e, n) {
				var r,
					o,
					i,
					a,
					c,
					s,
					u,
					f,
					l = n(1361),
					h = n(4795),
					p = n(6666),
					v = n(2589),
					d = 'wt-core';
				function y() {
					y = function () {
						return t;
					};
					var t = {},
						e = Object.prototype,
						n = e.hasOwnProperty,
						r = 'function' == typeof Symbol ? Symbol : {},
						o = r.iterator || '@@iterator',
						i = r.asyncIterator || '@@asyncIterator',
						a = r.toStringTag || '@@toStringTag';
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
					} catch (A) {
						c = function (t, e, n) {
							return (t[e] = n);
						};
					}
					function s(t, e, n, r) {
						var o = e && e.prototype instanceof l ? e : l,
							i = Object.create(o.prototype),
							a = new S(r || []);
						return (
							(i._invoke = (function (t, e, n) {
								var r = 'suspendedStart';
								return function (o, i) {
									if ('executing' === r)
										throw new Error('Generator is already running');
									if ('completed' === r) {
										if ('throw' === o) throw i;
										return O();
									}
									for (n.method = o, n.arg = i; ; ) {
										var a = n.delegate;
										if (a) {
											var c = k(a, n);
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
							})(t, n, a)),
							i
						);
					}
					function u(t, e, n) {
						try {
							return { type: 'normal', arg: t.call(e, n) };
						} catch (A) {
							return { type: 'throw', arg: A };
						}
					}
					t.wrap = s;
					var f = {};
					function l() {}
					function h() {}
					function p() {}
					var v = {};
					c(v, o, function () {
						return this;
					});
					var d = Object.getPrototypeOf,
						g = d && d(d(L([])));
					g && g !== e && n.call(g, o) && (v = g);
					var w = (p.prototype = l.prototype = Object.create(v));
					function m(t) {
						['next', 'throw', 'return'].forEach(function (e) {
							c(t, e, function (t) {
								return this._invoke(e, t);
							});
						});
					}
					function b(t, e) {
						function r(o, i, a, c) {
							var s = u(t[o], t, i);
							if ('throw' !== s.type) {
								var f = s.arg,
									l = f.value;
								return l && 'object' == typeof l && n.call(l, '__await')
									? e.resolve(l.__await).then(
											function (t) {
												r('next', t, a, c);
											},
											function (t) {
												r('throw', t, a, c);
											}
										)
									: e.resolve(l).then(
											function (t) {
												((f.value = t), a(f));
											},
											function (t) {
												return r('throw', t, a, c);
											}
										);
							}
							c(s.arg);
						}
						var o;
						this._invoke = function (t, n) {
							function i() {
								return new e(function (e, o) {
									r(t, n, e, o);
								});
							}
							return (o = o ? o.then(i, i) : i());
						};
					}
					function k(t, e) {
						var n = t.iterator[e.method];
						if (void 0 === n) {
							if (((e.delegate = null), 'throw' === e.method)) {
								if (
									t.iterator.return &&
									((e.method = 'return'),
									(e.arg = void 0),
									k(t, e),
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
						var o = r.arg;
						return o
							? o.done
								? ((e[t.resultName] = o.value),
									(e.next = t.nextLoc),
									'return' !== e.method &&
										((e.method = 'next'), (e.arg = void 0)),
									(e.delegate = null),
									f)
								: o
							: ((e.method = 'throw'),
								(e.arg = new TypeError('iterator result is not an object')),
								(e.delegate = null),
								f);
					}
					function E(t) {
						var e = { tryLoc: t[0] };
						(1 in t && (e.catchLoc = t[1]),
							2 in t && ((e.finallyLoc = t[2]), (e.afterLoc = t[3])),
							this.tryEntries.push(e));
					}
					function x(t) {
						var e = t.completion || {};
						((e.type = 'normal'), delete e.arg, (t.completion = e));
					}
					function S(t) {
						((this.tryEntries = [{ tryLoc: 'root' }]),
							t.forEach(E, this),
							this.reset(!0));
					}
					function L(t) {
						if (t) {
							var e = t[o];
							if (e) return e.call(t);
							if ('function' == typeof t.next) return t;
							if (!isNaN(t.length)) {
								var r = -1,
									i = function e() {
										for (; ++r < t.length; )
											if (n.call(t, r))
												return ((e.value = t[r]), (e.done = !1), e);
										return ((e.value = void 0), (e.done = !0), e);
									};
								return (i.next = i);
							}
						}
						return { next: O };
					}
					function O() {
						return { value: void 0, done: !0 };
					}
					return (
						(h.prototype = p),
						c(w, 'constructor', p),
						c(p, 'constructor', h),
						(h.displayName = c(p, a, 'GeneratorFunction')),
						(t.isGeneratorFunction = function (t) {
							var e = 'function' == typeof t && t.constructor;
							return (
								!!e &&
								(e === h || 'GeneratorFunction' === (e.displayName || e.name))
							);
						}),
						(t.mark = function (t) {
							return (
								Object.setPrototypeOf
									? Object.setPrototypeOf(t, p)
									: ((t.__proto__ = p), c(t, a, 'GeneratorFunction')),
								(t.prototype = Object.create(w)),
								t
							);
						}),
						(t.awrap = function (t) {
							return { __await: t };
						}),
						m(b.prototype),
						c(b.prototype, i, function () {
							return this;
						}),
						(t.AsyncIterator = b),
						(t.async = function (e, n, r, o, i) {
							void 0 === i && (i = Promise);
							var a = new b(s(e, n, r, o), i);
							return t.isGeneratorFunction(n)
								? a
								: a.next().then(function (t) {
										return t.done ? t.value : a.next();
									});
						}),
						m(w),
						c(w, a, 'Generator'),
						c(w, o, function () {
							return this;
						}),
						c(w, 'toString', function () {
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
						(t.values = L),
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
									this.tryEntries.forEach(x),
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
										(a.type = 'throw'),
										(a.arg = t),
										(e.next = n),
										r && ((e.method = 'next'), (e.arg = void 0)),
										!!r
									);
								}
								for (var o = this.tryEntries.length - 1; o >= 0; --o) {
									var i = this.tryEntries[o],
										a = i.completion;
									if ('root' === i.tryLoc) return r('end');
									if (i.tryLoc <= this.prev) {
										var c = n.call(i, 'catchLoc'),
											s = n.call(i, 'finallyLoc');
										if (c && s) {
											if (this.prev < i.catchLoc) return r(i.catchLoc, !0);
											if (this.prev < i.finallyLoc) return r(i.finallyLoc);
										} else if (c) {
											if (this.prev < i.catchLoc) return r(i.catchLoc, !0);
										} else {
											if (!s)
												throw new Error(
													'try statement without catch or finally'
												);
											if (this.prev < i.finallyLoc) return r(i.finallyLoc);
										}
									}
								}
							},
							abrupt: function (t, e) {
								for (var r = this.tryEntries.length - 1; r >= 0; --r) {
									var o = this.tryEntries[r];
									if (
										o.tryLoc <= this.prev &&
										n.call(o, 'finallyLoc') &&
										this.prev < o.finallyLoc
									) {
										var i = o;
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
										? ((this.method = 'next'), (this.next = i.finallyLoc), f)
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
									f
								);
							},
							finish: function (t) {
								for (var e = this.tryEntries.length - 1; e >= 0; --e) {
									var n = this.tryEntries[e];
									if (n.finallyLoc === t)
										return (this.complete(n.completion, n.afterLoc), x(n), f);
								}
							},
							catch: function (t) {
								for (var e = this.tryEntries.length - 1; e >= 0; --e) {
									var n = this.tryEntries[e];
									if (n.tryLoc === t) {
										var r = n.completion;
										if ('throw' === r.type) {
											var o = r.arg;
											x(n);
										}
										return o;
									}
								}
								throw new Error('illegal catch attempt');
							},
							delegateYield: function (t, e, n) {
								return (
									(this.delegate = { iterator: L(t), resultName: e, nextLoc: n }),
									'next' === this.method && (this.arg = void 0),
									f
								);
							}
						}),
						t
					);
				}
				function g() {
					return w.apply(this, arguments);
				}
				function w() {
					return (w = (0, h.Z)(
						y().mark(function t() {
							return y().wrap(function (t) {
								for (;;)
									switch ((t.prev = t.next)) {
										case 0:
											return ((t.next = 2), (0, v.X3)(d));
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
				function m() {
					return b.apply(this, arguments);
				}
				function b() {
					return (b = (0, h.Z)(
						y().mark(function t() {
							var e, n;
							return y().wrap(function (t) {
								for (;;)
									switch ((t.prev = t.next)) {
										case 0:
											if (f) {
												t.next = 3;
												break;
											}
											return ((t.next = 3), g());
										case 3:
											return (
												f.transaction(['events'], 'readwrite'),
												(t.next = 6),
												f.getAll('events')
											);
										case 6:
											((e = t.sent),
												(n = { mode: o.GetAllEvents, payload: e }),
												postMessage(n));
										case 9:
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
						y().mark(function t(e) {
							var n, r, o, i;
							return y().wrap(function (t) {
								for (;;)
									switch ((t.prev = t.next)) {
										case 0:
											if (f) {
												t.next = 3;
												break;
											}
											return ((t.next = 3), g());
										case 3:
											(f.transaction(['events'], 'readwrite'),
												(n = e),
												(r = (0, l.Z)(n)));
											try {
												for (r.s(); !(o = r.n()).done; )
													((i = o.value), f.delete('events', i));
											} catch (a) {
												r.e(a);
											} finally {
												r.f();
											}
										case 7:
										case 'end':
											return t.stop();
									}
							}, t);
						})
					)).apply(this, arguments);
				}
				function x(t) {
					return S.apply(this, arguments);
				}
				function S() {
					return (S = (0, h.Z)(
						y().mark(function t(e) {
							var n, r, o, i;
							return y().wrap(function (t) {
								for (;;)
									switch ((t.prev = t.next)) {
										case 0:
											if (f) {
												t.next = 3;
												break;
											}
											return ((t.next = 3), g());
										case 3:
											(f.transaction(['events'], 'readwrite'),
												(n = e),
												(r = (0, l.Z)(n)));
											try {
												for (r.s(); !(o = r.n()).done; )
													((i = o.value), f.put('events', i));
											} catch (a) {
												r.e(a);
											} finally {
												r.f();
											}
										case 7:
										case 'end':
											return t.stop();
									}
							}, t);
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
					})(o || (o = {})),
					(function (t) {
						((t[(t.Connect = 0)] = 'Connect'),
							(t[(t.Disconnect = 1)] = 'Disconnect'),
							(t[(t.SetSocketUrl = 2)] = 'SetSocketUrl'),
							(t[(t.OnSocketConnect = 3)] = 'OnSocketConnect'),
							(t[(t.OnSocketDisconnect = 4)] = 'OnSocketDisconnect'),
							(t[(t.OnSocketError = 5)] = 'OnSocketError'),
							(t[(t.OnSocketMessage = 6)] = 'OnSocketMessage'),
							(t[(t.SendMessage = 7)] = 'SendMessage'));
					})(i || (i = {})),
					(function (t) {
						((t[(t.DeleteMessages = 0)] = 'DeleteMessages'),
							(t[(t.GetAllMessages = 1)] = 'GetAllMessages'),
							(t[(t.SaveMessages = 2)] = 'SaveMessages'));
					})(a || (a = {})),
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
							i = n.payload,
							a = ((e = {}),
							(0, p.Z)(e, o.GetAllEvents, m),
							(0, p.Z)(e, o.RemoveEvents, k),
							(0, p.Z)(e, o.SaveEvents, x),
							e)[r];
						a && a(i);
					}));
			}
		},
		e = {};
	function n(r) {
		var o = e[r];
		if (void 0 !== o) return o.exports;
		var i = (e[r] = { exports: {} });
		return (t[r](i, i.exports, n), i.exports);
	}
	((n.m = t),
		(n.x = function () {
			var t = n.O(void 0, [755], function () {
				return n(1414);
			});
			return (t = n.O(t));
		}),
		(function () {
			var t = [];
			n.O = function (e, r, o, i) {
				if (!r) {
					var a = 1 / 0;
					for (f = 0; f < t.length; f++) {
						((r = t[f][0]), (o = t[f][1]), (i = t[f][2]));
						for (var c = !0, s = 0; s < r.length; s++)
							(!1 & i || a >= i) &&
							Object.keys(n.O).every(function (t) {
								return n.O[t](r[s]);
							})
								? r.splice(s--, 1)
								: ((c = !1), i < a && (a = i));
						if (c) {
							t.splice(f--, 1);
							var u = o();
							void 0 !== u && (e = u);
						}
					}
					return e;
				}
				i = i || 0;
				for (var f = t.length; f > 0 && t[f - 1][2] > i; f--) t[f] = t[f - 1];
				t[f] = [r, o, i];
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
			var t = { 414: 1 };
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
				var o = e[0],
					i = e[1],
					a = e[2];
				for (var c in i) n.o(i, c) && (n.m[c] = i[c]);
				for (a && a(n); o.length; ) t[o.pop()] = 1;
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
