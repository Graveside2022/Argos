/*! For license information please see 755.8d15b362.chunk.js.LICENSE.txt */
'use strict';
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
	[755],
	{
		926: function (t, e, r) {
			function n(t, e) {
				(null == e || e > t.length) && (e = t.length);
				for (var r = 0, n = new Array(e); r < e; r++) n[r] = t[r];
				return n;
			}
			r.d(e, {
				Z: function () {
					return n;
				}
			});
		},
		4795: function (t, e, r) {
			function n(t, e, r, n, o, i, a) {
				try {
					var c = t[i](a),
						u = c.value;
				} catch (f) {
					return void r(f);
				}
				c.done ? e(u) : Promise.resolve(u).then(n, o);
			}
			function o(t) {
				return function () {
					var e = this,
						r = arguments;
					return new Promise(function (o, i) {
						var a = t.apply(e, r);
						function c(t) {
							n(a, o, i, c, u, 'next', t);
						}
						function u(t) {
							n(a, o, i, c, u, 'throw', t);
						}
						c(void 0);
					});
				};
			}
			r.d(e, {
				Z: function () {
					return o;
				}
			});
		},
		1361: function (t, e, r) {
			r.d(e, {
				Z: function () {
					return o;
				}
			});
			var n = r(9147);
			function o(t, e) {
				var r = ('undefined' !== typeof Symbol && t[Symbol.iterator]) || t['@@iterator'];
				if (!r) {
					if (
						Array.isArray(t) ||
						(r = (0, n.Z)(t)) ||
						(e && t && 'number' === typeof t.length)
					) {
						r && (t = r);
						var o = 0,
							i = function () {};
						return {
							s: i,
							n: function () {
								return o >= t.length ? { done: !0 } : { done: !1, value: t[o++] };
							},
							e: function (t) {
								throw t;
							},
							f: i
						};
					}
					throw new TypeError(
						'Invalid attempt to iterate non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.'
					);
				}
				var a,
					c = !0,
					u = !1;
				return {
					s: function () {
						r = r.call(t);
					},
					n: function () {
						var t = r.next();
						return ((c = t.done), t);
					},
					e: function (t) {
						((u = !0), (a = t));
					},
					f: function () {
						try {
							c || null == r.return || r.return();
						} finally {
							if (u) throw a;
						}
					}
				};
			}
		},
		6666: function (t, e, r) {
			function n(t, e, r) {
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
			}
			r.d(e, {
				Z: function () {
					return n;
				}
			});
		},
		3028: function (t, e, r) {
			r.d(e, {
				Z: function () {
					return i;
				}
			});
			var n = r(6666);
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
			function i(t) {
				for (var e = 1; e < arguments.length; e++) {
					var r = null != arguments[e] ? arguments[e] : {};
					e % 2
						? o(Object(r), !0).forEach(function (e) {
								(0, n.Z)(t, e, r[e]);
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
			}
		},
		9147: function (t, e, r) {
			r.d(e, {
				Z: function () {
					return o;
				}
			});
			var n = r(926);
			function o(t, e) {
				if (t) {
					if ('string' === typeof t) return (0, n.Z)(t, e);
					var r = Object.prototype.toString.call(t).slice(8, -1);
					return (
						'Object' === r && t.constructor && (r = t.constructor.name),
						'Map' === r || 'Set' === r
							? Array.from(t)
							: 'Arguments' === r ||
								  /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(r)
								? (0, n.Z)(t, e)
								: void 0
					);
				}
			}
		},
		2589: function (t, e, r) {
			r.d(e, {
				X3: function () {
					return c;
				}
			});
			var n = r(3028),
				o = r(4795),
				i = r(4788);
			function a() {
				a = function () {
					return t;
				};
				var t = {},
					e = Object.prototype,
					r = e.hasOwnProperty,
					n = 'function' == typeof Symbol ? Symbol : {},
					o = n.iterator || '@@iterator',
					i = n.asyncIterator || '@@asyncIterator',
					c = n.toStringTag || '@@toStringTag';
				function u(t, e, r) {
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
					u({}, '');
				} catch (I) {
					u = function (t, e, r) {
						return (t[e] = r);
					};
				}
				function f(t, e, r, n) {
					var o = e && e.prototype instanceof h ? e : h,
						i = Object.create(o.prototype),
						a = new O(n || []);
					return (
						(i._invoke = (function (t, e, r) {
							var n = 'suspendedStart';
							return function (o, i) {
								if ('executing' === n)
									throw new Error('Generator is already running');
								if ('completed' === n) {
									if ('throw' === o) throw i;
									return D();
								}
								for (r.method = o, r.arg = i; ; ) {
									var a = r.delegate;
									if (a) {
										var c = E(a, r);
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
									var u = s(t, e, r);
									if ('normal' === u.type) {
										if (
											((n = r.done ? 'completed' : 'suspendedYield'),
											u.arg === l)
										)
											continue;
										return { value: u.arg, done: r.done };
									}
									'throw' === u.type &&
										((n = 'completed'), (r.method = 'throw'), (r.arg = u.arg));
								}
							};
						})(t, r, a)),
						i
					);
				}
				function s(t, e, r) {
					try {
						return { type: 'normal', arg: t.call(e, r) };
					} catch (I) {
						return { type: 'throw', arg: I };
					}
				}
				t.wrap = f;
				var l = {};
				function h() {}
				function p() {}
				function d() {}
				var v = {};
				u(v, o, function () {
					return this;
				});
				var y = Object.getPrototypeOf,
					g = y && y(y(j([])));
				g && g !== e && r.call(g, o) && (v = g);
				var w = (d.prototype = h.prototype = Object.create(v));
				function m(t) {
					['next', 'throw', 'return'].forEach(function (e) {
						u(t, e, function (t) {
							return this._invoke(e, t);
						});
					});
				}
				function b(t, e) {
					function n(o, i, a, c) {
						var u = s(t[o], t, i);
						if ('throw' !== u.type) {
							var f = u.arg,
								l = f.value;
							return l && 'object' == typeof l && r.call(l, '__await')
								? e.resolve(l.__await).then(
										function (t) {
											n('next', t, a, c);
										},
										function (t) {
											n('throw', t, a, c);
										}
									)
								: e.resolve(l).then(
										function (t) {
											((f.value = t), a(f));
										},
										function (t) {
											return n('throw', t, a, c);
										}
									);
						}
						c(u.arg);
					}
					var o;
					this._invoke = function (t, r) {
						function i() {
							return new e(function (e, o) {
								n(t, r, e, o);
							});
						}
						return (o = o ? o.then(i, i) : i());
					};
				}
				function E(t, e) {
					var r = t.iterator[e.method];
					if (void 0 === r) {
						if (((e.delegate = null), 'throw' === e.method)) {
							if (
								t.iterator.return &&
								((e.method = 'return'),
								(e.arg = void 0),
								E(t, e),
								'throw' === e.method)
							)
								return l;
							((e.method = 'throw'),
								(e.arg = new TypeError(
									"The iterator does not provide a 'throw' method"
								)));
						}
						return l;
					}
					var n = s(r, t.iterator, e.arg);
					if ('throw' === n.type)
						return ((e.method = 'throw'), (e.arg = n.arg), (e.delegate = null), l);
					var o = n.arg;
					return o
						? o.done
							? ((e[t.resultName] = o.value),
								(e.next = t.nextLoc),
								'return' !== e.method && ((e.method = 'next'), (e.arg = void 0)),
								(e.delegate = null),
								l)
							: o
						: ((e.method = 'throw'),
							(e.arg = new TypeError('iterator result is not an object')),
							(e.delegate = null),
							l);
				}
				function L(t) {
					var e = { tryLoc: t[0] };
					(1 in t && (e.catchLoc = t[1]),
						2 in t && ((e.finallyLoc = t[2]), (e.afterLoc = t[3])),
						this.tryEntries.push(e));
				}
				function x(t) {
					var e = t.completion || {};
					((e.type = 'normal'), delete e.arg, (t.completion = e));
				}
				function O(t) {
					((this.tryEntries = [{ tryLoc: 'root' }]), t.forEach(L, this), this.reset(!0));
				}
				function j(t) {
					if (t) {
						var e = t[o];
						if (e) return e.call(t);
						if ('function' == typeof t.next) return t;
						if (!isNaN(t.length)) {
							var n = -1,
								i = function e() {
									for (; ++n < t.length; )
										if (r.call(t, n))
											return ((e.value = t[n]), (e.done = !1), e);
									return ((e.value = void 0), (e.done = !0), e);
								};
							return (i.next = i);
						}
					}
					return { next: D };
				}
				function D() {
					return { value: void 0, done: !0 };
				}
				return (
					(p.prototype = d),
					u(w, 'constructor', d),
					u(d, 'constructor', p),
					(p.displayName = u(d, c, 'GeneratorFunction')),
					(t.isGeneratorFunction = function (t) {
						var e = 'function' == typeof t && t.constructor;
						return (
							!!e && (e === p || 'GeneratorFunction' === (e.displayName || e.name))
						);
					}),
					(t.mark = function (t) {
						return (
							Object.setPrototypeOf
								? Object.setPrototypeOf(t, d)
								: ((t.__proto__ = d), u(t, c, 'GeneratorFunction')),
							(t.prototype = Object.create(w)),
							t
						);
					}),
					(t.awrap = function (t) {
						return { __await: t };
					}),
					m(b.prototype),
					u(b.prototype, i, function () {
						return this;
					}),
					(t.AsyncIterator = b),
					(t.async = function (e, r, n, o, i) {
						void 0 === i && (i = Promise);
						var a = new b(f(e, r, n, o), i);
						return t.isGeneratorFunction(r)
							? a
							: a.next().then(function (t) {
									return t.done ? t.value : a.next();
								});
					}),
					m(w),
					u(w, c, 'Generator'),
					u(w, o, function () {
						return this;
					}),
					u(w, 'toString', function () {
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
					(t.values = j),
					(O.prototype = {
						constructor: O,
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
									(a.type = 'throw'),
									(a.arg = t),
									(e.next = r),
									n && ((e.method = 'next'), (e.arg = void 0)),
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
						abrupt: function (t, e) {
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
								('break' === t || 'continue' === t) &&
								i.tryLoc <= e &&
								e <= i.finallyLoc &&
								(i = null);
							var a = i ? i.completion : {};
							return (
								(a.type = t),
								(a.arg = e),
								i
									? ((this.method = 'next'), (this.next = i.finallyLoc), l)
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
								l
							);
						},
						finish: function (t) {
							for (var e = this.tryEntries.length - 1; e >= 0; --e) {
								var r = this.tryEntries[e];
								if (r.finallyLoc === t)
									return (this.complete(r.completion, r.afterLoc), x(r), l);
							}
						},
						catch: function (t) {
							for (var e = this.tryEntries.length - 1; e >= 0; --e) {
								var r = this.tryEntries[e];
								if (r.tryLoc === t) {
									var n = r.completion;
									if ('throw' === n.type) {
										var o = n.arg;
										x(r);
									}
									return o;
								}
							}
							throw new Error('illegal catch attempt');
						},
						delegateYield: function (t, e, r) {
							return (
								(this.delegate = { iterator: j(t), resultName: e, nextLoc: r }),
								'next' === this.method && (this.arg = void 0),
								l
							);
						}
					}),
					t
				);
			}
			function c(t, e) {
				var r = arguments.length > 2 && void 0 !== arguments[2] ? arguments[2] : {},
					n = r.blocked,
					o = r.upgrade,
					a = r.blocking,
					c = r.terminated,
					u = indexedDB.open(t, e),
					f = (0, i.w)(u);
				return (
					o &&
						u.addEventListener('upgradeneeded', function (t) {
							o(
								(0, i.w)(u.result),
								t.oldVersion,
								t.newVersion,
								(0, i.w)(u.transaction),
								t
							);
						}),
					n &&
						u.addEventListener('blocked', function (t) {
							return n(t.oldVersion, t.newVersion, t);
						}),
					f
						.then(function (t) {
							(c &&
								t.addEventListener('close', function () {
									return c();
								}),
								a &&
									t.addEventListener('versionchange', function (t) {
										return a(t.oldVersion, t.newVersion, t);
									}));
						})
						.catch(function () {}),
					f
				);
			}
			var u = ['get', 'getKey', 'getAll', 'getAllKeys', 'count'],
				f = ['put', 'add', 'delete', 'clear'],
				s = new Map();
			function l(t, e) {
				if (t instanceof IDBDatabase && !(e in t) && 'string' === typeof e) {
					if (s.get(e)) return s.get(e);
					var r = e.replace(/FromIndex$/, ''),
						n = e !== r,
						i = f.includes(r);
					if (r in (n ? IDBIndex : IDBObjectStore).prototype && (i || u.includes(r))) {
						var c = (function () {
							var t = (0, o.Z)(
								a().mark(function t(e) {
									var o,
										c,
										u,
										f,
										s,
										l,
										h = arguments;
									return a().wrap(
										function (t) {
											for (;;)
												switch ((t.prev = t.next)) {
													case 0:
														for (
															c = this.transaction(
																e,
																i ? 'readwrite' : 'readonly'
															),
																u = c.store,
																f = h.length,
																s = new Array(f > 1 ? f - 1 : 0),
																l = 1;
															l < f;
															l++
														)
															s[l - 1] = h[l];
														return (
															n && (u = u.index(s.shift())),
															(t.next = 6),
															Promise.all([
																(o = u)[r].apply(o, s),
																i && c.done
															])
														);
													case 6:
														return t.abrupt('return', t.sent[0]);
													case 7:
													case 'end':
														return t.stop();
												}
										},
										t,
										this
									);
								})
							);
							return function (e) {
								return t.apply(this, arguments);
							};
						})();
						return (s.set(e, c), c);
					}
				}
			}
			(0, i.r)(function (t) {
				return (0, n.Z)(
					(0, n.Z)({}, t),
					{},
					{
						get: function (e, r, n) {
							return l(e, r) || t.get(e, r, n);
						},
						has: function (e, r) {
							return !!l(e, r) || t.has(e, r);
						}
					}
				);
			});
		},
		4788: function (t, e, r) {
			r.d(e, {
				r: function () {
					return l;
				},
				w: function () {
					return d;
				}
			});
			var n, o;
			var i = new WeakMap(),
				a = new WeakMap(),
				c = new WeakMap(),
				u = new WeakMap(),
				f = new WeakMap();
			var s = {
				get: function (t, e, r) {
					if (t instanceof IDBTransaction) {
						if ('done' === e) return a.get(t);
						if ('objectStoreNames' === e) return t.objectStoreNames || c.get(t);
						if ('store' === e)
							return r.objectStoreNames[1]
								? void 0
								: r.objectStore(r.objectStoreNames[0]);
					}
					return d(t[e]);
				},
				set: function (t, e, r) {
					return ((t[e] = r), !0);
				},
				has: function (t, e) {
					return (
						(t instanceof IDBTransaction && ('done' === e || 'store' === e)) || e in t
					);
				}
			};
			function l(t) {
				s = t(s);
			}
			function h(t) {
				return t !== IDBDatabase.prototype.transaction ||
					'objectStoreNames' in IDBTransaction.prototype
					? (
							o ||
							(o = [
								IDBCursor.prototype.advance,
								IDBCursor.prototype.continue,
								IDBCursor.prototype.continuePrimaryKey
							])
						).includes(t)
						? function () {
								for (var e = arguments.length, r = new Array(e), n = 0; n < e; n++)
									r[n] = arguments[n];
								return (t.apply(v(this), r), d(i.get(this)));
							}
						: function () {
								for (var e = arguments.length, r = new Array(e), n = 0; n < e; n++)
									r[n] = arguments[n];
								return d(t.apply(v(this), r));
							}
					: function (e) {
							for (
								var r = arguments.length, n = new Array(r > 1 ? r - 1 : 0), o = 1;
								o < r;
								o++
							)
								n[o - 1] = arguments[o];
							var i = t.call.apply(t, [v(this), e].concat(n));
							return (c.set(i, e.sort ? e.sort() : [e]), d(i));
						};
			}
			function p(t) {
				return 'function' === typeof t
					? h(t)
					: (t instanceof IDBTransaction &&
							(function (t) {
								if (!a.has(t)) {
									var e = new Promise(function (e, r) {
										var n = function () {
												(t.removeEventListener('complete', o),
													t.removeEventListener('error', i),
													t.removeEventListener('abort', i));
											},
											o = function () {
												(e(), n());
											},
											i = function () {
												(r(
													t.error ||
														new DOMException('AbortError', 'AbortError')
												),
													n());
											};
										(t.addEventListener('complete', o),
											t.addEventListener('error', i),
											t.addEventListener('abort', i));
									});
									a.set(t, e);
								}
							})(t),
						(e = t),
						(
							n ||
							(n = [IDBDatabase, IDBObjectStore, IDBIndex, IDBCursor, IDBTransaction])
						).some(function (t) {
							return e instanceof t;
						})
							? new Proxy(t, s)
							: t);
				var e;
			}
			function d(t) {
				if (t instanceof IDBRequest)
					return (function (t) {
						var e = new Promise(function (e, r) {
							var n = function () {
									(t.removeEventListener('success', o),
										t.removeEventListener('error', i));
								},
								o = function () {
									(e(d(t.result)), n());
								},
								i = function () {
									(r(t.error), n());
								};
							(t.addEventListener('success', o), t.addEventListener('error', i));
						});
						return (
							e
								.then(function (e) {
									e instanceof IDBCursor && i.set(e, t);
								})
								.catch(function () {}),
							f.set(e, t),
							e
						);
					})(t);
				if (u.has(t)) return u.get(t);
				var e = p(t);
				return (e !== t && (u.set(t, e), f.set(e, t)), e);
			}
			var v = function (t) {
				return f.get(t);
			};
		}
	}
]);
