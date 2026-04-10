/*! For license information please see 68.0da9e87a.chunk.js.LICENSE.txt */
!(function () {
	'use strict';
	var t = {
			8068: function (t, e, r) {
				var n,
					o,
					a,
					i,
					c,
					s,
					u,
					f,
					l = r(1361),
					h = r(4795),
					p = r(6666),
					d = r(2589),
					v = 'wt-core';
				function g() {
					g = function () {
						return t;
					};
					var t = {},
						e = Object.prototype,
						r = e.hasOwnProperty,
						n = 'function' == typeof Symbol ? Symbol : {},
						o = n.iterator || '@@iterator',
						a = n.asyncIterator || '@@asyncIterator',
						i = n.toStringTag || '@@toStringTag';
					function c(t, e, r) {
						return (
							Object.defineProperty(t, e, {
								value: r,
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
						c = function (t, e, r) {
							return (t[e] = r);
						};
					}
					function s(t, e, r, n) {
						var o = e && e.prototype instanceof l ? e : l,
							a = Object.create(o.prototype),
							i = new S(n || []);
						return (
							(a._invoke = (function (t, e, r) {
								var n = 'suspendedStart';
								return function (o, a) {
									if ('executing' === n)
										throw new Error('Generator is already running');
									if ('completed' === n) {
										if ('throw' === o) throw a;
										return O();
									}
									for (r.method = o, r.arg = a; ; ) {
										var i = r.delegate;
										if (i) {
											var c = k(i, r);
											if (c) {
												if (c === f) continue;
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
										var s = u(t, e, r);
										if ('normal' === s.type) {
											if (
												((n = r.done ? 'completed' : 'suspendedYield'),
												s.arg === f)
											)
												continue;
											return { value: s.arg, done: r.done };
										}
										'throw' === s.type &&
											((n = 'completed'),
											(r.method = 'throw'),
											(r.arg = s.arg));
									}
								};
							})(t, r, i)),
							a
						);
					}
					function u(t, e, r) {
						try {
							return { type: 'normal', arg: t.call(e, r) };
						} catch (A) {
							return { type: 'throw', arg: A };
						}
					}
					t.wrap = s;
					var f = {};
					function l() {}
					function h() {}
					function p() {}
					var d = {};
					c(d, o, function () {
						return this;
					});
					var v = Object.getPrototypeOf,
						y = v && v(v(L([])));
					y && y !== e && r.call(y, o) && (d = y);
					var m = (p.prototype = l.prototype = Object.create(d));
					function w(t) {
						['next', 'throw', 'return'].forEach(function (e) {
							c(t, e, function (t) {
								return this._invoke(e, t);
							});
						});
					}
					function b(t, e) {
						function n(o, a, i, c) {
							var s = u(t[o], t, a);
							if ('throw' !== s.type) {
								var f = s.arg,
									l = f.value;
								return l && 'object' == typeof l && r.call(l, '__await')
									? e.resolve(l.__await).then(
											function (t) {
												n('next', t, i, c);
											},
											function (t) {
												n('throw', t, i, c);
											}
										)
									: e.resolve(l).then(
											function (t) {
												((f.value = t), i(f));
											},
											function (t) {
												return n('throw', t, i, c);
											}
										);
							}
							c(s.arg);
						}
						var o;
						this._invoke = function (t, r) {
							function a() {
								return new e(function (e, o) {
									n(t, r, e, o);
								});
							}
							return (o = o ? o.then(a, a) : a());
						};
					}
					function k(t, e) {
						var r = t.iterator[e.method];
						if (void 0 === r) {
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
						var n = u(r, t.iterator, e.arg);
						if ('throw' === n.type)
							return ((e.method = 'throw'), (e.arg = n.arg), (e.delegate = null), f);
						var o = n.arg;
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
					function x(t) {
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
							t.forEach(x, this),
							this.reset(!0));
					}
					function L(t) {
						if (t) {
							var e = t[o];
							if (e) return e.call(t);
							if ('function' == typeof t.next) return t;
							if (!isNaN(t.length)) {
								var n = -1,
									a = function e() {
										for (; ++n < t.length; )
											if (r.call(t, n))
												return ((e.value = t[n]), (e.done = !1), e);
										return ((e.value = void 0), (e.done = !0), e);
									};
								return (a.next = a);
							}
						}
						return { next: O };
					}
					function O() {
						return { value: void 0, done: !0 };
					}
					return (
						(h.prototype = p),
						c(m, 'constructor', p),
						c(p, 'constructor', h),
						(h.displayName = c(p, i, 'GeneratorFunction')),
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
									: ((t.__proto__ = p), c(t, i, 'GeneratorFunction')),
								(t.prototype = Object.create(m)),
								t
							);
						}),
						(t.awrap = function (t) {
							return { __await: t };
						}),
						w(b.prototype),
						c(b.prototype, a, function () {
							return this;
						}),
						(t.AsyncIterator = b),
						(t.async = function (e, r, n, o, a) {
							void 0 === a && (a = Promise);
							var i = new b(s(e, r, n, o), a);
							return t.isGeneratorFunction(r)
								? i
								: i.next().then(function (t) {
										return t.done ? t.value : i.next();
									});
						}),
						w(m),
						c(m, i, 'Generator'),
						c(m, o, function () {
							return this;
						}),
						c(m, 'toString', function () {
							return '[object Generator]';
						}),
						(t.keys = function (t) {
							var e = [];
							for (var r in t) e.push(r);
							return (
								e.reverse(),
								function r() {
									for (; e.length; ) {
										var n = e.pop();
										if (n in t) return ((r.value = n), (r.done = !1), r);
									}
									return ((r.done = !0), r);
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
									this.tryEntries.forEach(E),
									!t)
								)
									for (var e in this)
										't' === e.charAt(0) &&
											r.call(this, e) &&
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
								function n(r, n) {
									return (
										(i.type = 'throw'),
										(i.arg = t),
										(e.next = r),
										n && ((e.method = 'next'), (e.arg = void 0)),
										!!n
									);
								}
								for (var o = this.tryEntries.length - 1; o >= 0; --o) {
									var a = this.tryEntries[o],
										i = a.completion;
									if ('root' === a.tryLoc) return n('end');
									if (a.tryLoc <= this.prev) {
										var c = r.call(a, 'catchLoc'),
											s = r.call(a, 'finallyLoc');
										if (c && s) {
											if (this.prev < a.catchLoc) return n(a.catchLoc, !0);
											if (this.prev < a.finallyLoc) return n(a.finallyLoc);
										} else if (c) {
											if (this.prev < a.catchLoc) return n(a.catchLoc, !0);
										} else {
											if (!s)
												throw new Error(
													'try statement without catch or finally'
												);
											if (this.prev < a.finallyLoc) return n(a.finallyLoc);
										}
									}
								}
							},
							abrupt: function (t, e) {
								for (var n = this.tryEntries.length - 1; n >= 0; --n) {
									var o = this.tryEntries[n];
									if (
										o.tryLoc <= this.prev &&
										r.call(o, 'finallyLoc') &&
										this.prev < o.finallyLoc
									) {
										var a = o;
										break;
									}
								}
								a &&
									('break' === t || 'continue' === t) &&
									a.tryLoc <= e &&
									e <= a.finallyLoc &&
									(a = null);
								var i = a ? a.completion : {};
								return (
									(i.type = t),
									(i.arg = e),
									a
										? ((this.method = 'next'), (this.next = a.finallyLoc), f)
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
									var r = this.tryEntries[e];
									if (r.finallyLoc === t)
										return (this.complete(r.completion, r.afterLoc), E(r), f);
								}
							},
							catch: function (t) {
								for (var e = this.tryEntries.length - 1; e >= 0; --e) {
									var r = this.tryEntries[e];
									if (r.tryLoc === t) {
										var n = r.completion;
										if ('throw' === n.type) {
											var o = n.arg;
											E(r);
										}
										return o;
									}
								}
								throw new Error('illegal catch attempt');
							},
							delegateYield: function (t, e, r) {
								return (
									(this.delegate = { iterator: L(t), resultName: e, nextLoc: r }),
									'next' === this.method && (this.arg = void 0),
									f
								);
							}
						}),
						t
					);
				}
				function y() {
					return m.apply(this, arguments);
				}
				function m() {
					return (m = (0, h.Z)(
						g().mark(function t() {
							return g().wrap(function (t) {
								for (;;)
									switch ((t.prev = t.next)) {
										case 0:
											return ((t.next = 2), (0, d.X3)(v));
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
				function w(t) {
					return b.apply(this, arguments);
				}
				function b() {
					return (b = (0, h.Z)(
						g().mark(function t(e) {
							var r, n, o, a;
							return g().wrap(function (t) {
								for (;;)
									switch ((t.prev = t.next)) {
										case 0:
											if (f) {
												t.next = 3;
												break;
											}
											return ((t.next = 3), y());
										case 3:
											((r = e),
												f.transaction(['chat-messages'], 'readwrite'),
												(n = (0, l.Z)(r)));
											try {
												for (n.s(); !(o = n.n()).done; )
													((a = o.value), f.put('chat-messages', a));
											} catch (i) {
												n.e(i);
											} finally {
												n.f();
											}
										case 7:
										case 'end':
											return t.stop();
									}
							}, t);
						})
					)).apply(this, arguments);
				}
				function k() {
					return x.apply(this, arguments);
				}
				function x() {
					return (x = (0, h.Z)(
						g().mark(function t() {
							return g().wrap(function (t) {
								for (;;)
									switch ((t.prev = t.next)) {
										case 0:
											if (f) {
												t.next = 3;
												break;
											}
											return ((t.next = 3), y());
										case 3:
											(f.transaction(['chat-messages'], 'readwrite'),
												f.getAll('chat-messages').then(function (t) {
													var e = { mode: i.GetAllMessages, payload: t };
													postMessage(e);
												}));
										case 5:
										case 'end':
											return t.stop();
									}
							}, t);
						})
					)).apply(this, arguments);
				}
				function E(t) {
					return S.apply(this, arguments);
				}
				function S() {
					return (S = (0, h.Z)(
						g().mark(function t(e) {
							var r, n, o, a;
							return g().wrap(function (t) {
								for (;;)
									switch ((t.prev = t.next)) {
										case 0:
											if (f) {
												t.next = 3;
												break;
											}
											return ((t.next = 3), y());
										case 3:
											((r = e),
												f.transaction(['chat-messages'], 'readwrite'),
												(n = (0, l.Z)(r)));
											try {
												for (n.s(); !(o = n.n()).done; )
													((a = o.value), f.delete('chat-messages', a));
											} catch (i) {
												n.e(i);
											} finally {
												n.f();
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
				})(n || (n = {})),
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
					})(a || (a = {})),
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
							r = t.data,
							n = r.mode,
							o = r.payload,
							a = ((e = {}),
							(0, p.Z)(e, i.DeleteMessages, E),
							(0, p.Z)(e, i.GetAllMessages, k),
							(0, p.Z)(e, i.SaveMessages, w),
							e)[n];
						a && a(o);
					}));
			}
		},
		e = {};
	function r(n) {
		var o = e[n];
		if (void 0 !== o) return o.exports;
		var a = (e[n] = { exports: {} });
		return (t[n](a, a.exports, r), a.exports);
	}
	((r.m = t),
		(r.x = function () {
			var t = r.O(void 0, [755], function () {
				return r(8068);
			});
			return (t = r.O(t));
		}),
		(function () {
			var t = [];
			r.O = function (e, n, o, a) {
				if (!n) {
					var i = 1 / 0;
					for (f = 0; f < t.length; f++) {
						((n = t[f][0]), (o = t[f][1]), (a = t[f][2]));
						for (var c = !0, s = 0; s < n.length; s++)
							(!1 & a || i >= a) &&
							Object.keys(r.O).every(function (t) {
								return r.O[t](n[s]);
							})
								? n.splice(s--, 1)
								: ((c = !1), a < i && (i = a));
						if (c) {
							t.splice(f--, 1);
							var u = o();
							void 0 !== u && (e = u);
						}
					}
					return e;
				}
				a = a || 0;
				for (var f = t.length; f > 0 && t[f - 1][2] > a; f--) t[f] = t[f - 1];
				t[f] = [n, o, a];
			};
		})(),
		(r.d = function (t, e) {
			for (var n in e)
				r.o(e, n) &&
					!r.o(t, n) &&
					Object.defineProperty(t, n, { enumerable: !0, get: e[n] });
		}),
		(r.f = {}),
		(r.e = function (t) {
			return Promise.all(
				Object.keys(r.f).reduce(function (e, n) {
					return (r.f[n](t, e), e);
				}, [])
			);
		}),
		(r.u = function (t) {
			return 'static/js/' + t + '.8d15b362.chunk.js';
		}),
		(r.miniCssF = function (t) {}),
		(r.g = (function () {
			if ('object' === typeof globalThis) return globalThis;
			try {
				return this || new Function('return this')();
			} catch (t) {
				if ('object' === typeof window) return window;
			}
		})()),
		(r.o = function (t, e) {
			return Object.prototype.hasOwnProperty.call(t, e);
		}),
		(function () {
			var t;
			r.g.importScripts && (t = r.g.location + '');
			var e = r.g.document;
			if (!t && e && (e.currentScript && (t = e.currentScript.src), !t)) {
				var n = e.getElementsByTagName('script');
				n.length && (t = n[n.length - 1].src);
			}
			if (!t) throw new Error('Automatic publicPath is not supported in this browser');
			((t = t
				.replace(/#.*$/, '')
				.replace(/\?.*$/, '')
				.replace(/\/[^\/]+$/, '/')),
				(r.p = t + '../../'));
		})(),
		(function () {
			var t = { 68: 1 };
			r.f.i = function (e, n) {
				t[e] || importScripts(r.p + r.u(e));
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
				var o = e[0],
					a = e[1],
					i = e[2];
				for (var c in a) r.o(a, c) && (r.m[c] = a[c]);
				for (i && i(r); o.length; ) t[o.pop()] = 1;
				n(e);
			};
		})(),
		(function () {
			var t = r.x;
			r.x = function () {
				return r.e(755).then(t);
			};
		})());
	r.x();
})();
