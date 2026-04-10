/*! For license information please see 361.eb4dbaf2.chunk.js.LICENSE.txt */
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
	[361],
	{
		1625: function (t, e, r) {
			var n = r(7716);
			t.exports = function (t, e, r) {
				var i = (r && r.debug) || !1,
					o = (r && r.startIndex) || 0;
				i && console.log('starting findTagByName with', e, ' and ', r);
				var a = n(t, '<'.concat(e, '[ >]'), o);
				if ((i && console.log('start:', a), -1 !== a)) {
					var u = t.slice(a + e.length),
						c = n(u, '[ /]' + e + '>', 0),
						s = -1 === c;
					s && (c = n(u, '[ /]>', 0));
					var f = a + e.length + c + 1 + (s ? 0 : e.length) + 1;
					if ((i && console.log('end:', f), -1 !== f)) {
						var l = t.slice(a, f);
						return {
							inner: s ? null : l.slice(l.indexOf('>') + 1, l.lastIndexOf('<')),
							outer: l,
							start: a,
							end: f
						};
					}
				}
			};
		},
		7185: function (t, e, r) {
			var n = r(1625);
			t.exports = function (t, e, r) {
				for (
					var i, o = [], a = (r && r.debug) || !1, u = (r && r.startIndex) || 0;
					(i = n(t, e, { debug: a, startIndex: u }));

				)
					((u = i.end), o.push(i));
				return (a && console.log('findTagsByName found', o.length, 'tags'), o);
			};
		},
		9500: function (t) {
			t.exports = function (t, e, r) {
				var n = (r && r.debug) || !1;
				n && console.log('getting ' + e + ' in ' + t);
				var i = 'object' === typeof t ? t.outer : t,
					o = ''.concat(e, '\\="([^"]*)"');
				n && console.log('pattern:', o);
				var a = new RegExp(o).exec(i);
				if ((n && console.log('match:', a), a)) return a[1];
			};
		},
		7716: function (t) {
			t.exports = function (t, e, r) {
				var n = new RegExp(e).exec(t.slice(r));
				return n ? r + n.index : -1;
			};
		},
		753: function (t, e, r) {
			'use strict';
			function n(t) {
				if (void 0 === t)
					throw new ReferenceError(
						"this hasn't been initialised - super() hasn't been called"
					);
				return t;
			}
			r.d(e, {
				Z: function () {
					return n;
				}
			});
		},
		4795: function (t, e, r) {
			'use strict';
			function n(t, e, r, n, i, o, a) {
				try {
					var u = t[o](a),
						c = u.value;
				} catch (s) {
					return void r(s);
				}
				u.done ? e(c) : Promise.resolve(c).then(n, i);
			}
			function i(t) {
				return function () {
					var e = this,
						r = arguments;
					return new Promise(function (i, o) {
						var a = t.apply(e, r);
						function u(t) {
							n(a, i, o, u, c, 'next', t);
						}
						function c(t) {
							n(a, i, o, u, c, 'throw', t);
						}
						u(void 0);
					});
				};
			}
			r.d(e, {
				Z: function () {
					return i;
				}
			});
		},
		9249: function (t, e, r) {
			'use strict';
			function n(t, e) {
				if (!(t instanceof e)) throw new TypeError('Cannot call a class as a function');
			}
			r.d(e, {
				Z: function () {
					return n;
				}
			});
		},
		7371: function (t, e, r) {
			'use strict';
			function n(t, e) {
				for (var r = 0; r < e.length; r++) {
					var n = e[r];
					((n.enumerable = n.enumerable || !1),
						(n.configurable = !0),
						'value' in n && (n.writable = !0),
						Object.defineProperty(t, n.key, n));
				}
			}
			function i(t, e, r) {
				return (
					e && n(t.prototype, e),
					r && n(t, r),
					Object.defineProperty(t, 'prototype', { writable: !1 }),
					t
				);
			}
			r.d(e, {
				Z: function () {
					return i;
				}
			});
		},
		6906: function (t, e, r) {
			'use strict';
			r.d(e, {
				Z: function () {
					return a;
				}
			});
			var n = r(5058),
				i = r(352),
				o = r(1987);
			function a(t) {
				var e = (0, i.Z)();
				return function () {
					var r,
						i = (0, n.Z)(t);
					if (e) {
						var a = (0, n.Z)(this).constructor;
						r = Reflect.construct(i, arguments, a);
					} else r = i.apply(this, arguments);
					return (0, o.Z)(this, r);
				};
			}
		},
		6666: function (t, e, r) {
			'use strict';
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
		5058: function (t, e, r) {
			'use strict';
			function n(t) {
				return (
					(n = Object.setPrototypeOf
						? Object.getPrototypeOf
						: function (t) {
								return t.__proto__ || Object.getPrototypeOf(t);
							}),
					n(t)
				);
			}
			r.d(e, {
				Z: function () {
					return n;
				}
			});
		},
		5754: function (t, e, r) {
			'use strict';
			r.d(e, {
				Z: function () {
					return i;
				}
			});
			var n = r(8960);
			function i(t, e) {
				if ('function' !== typeof e && null !== e)
					throw new TypeError('Super expression must either be null or a function');
				((t.prototype = Object.create(e && e.prototype, {
					constructor: { value: t, writable: !0, configurable: !0 }
				})),
					Object.defineProperty(t, 'prototype', { writable: !1 }),
					e && (0, n.Z)(t, e));
			}
		},
		352: function (t, e, r) {
			'use strict';
			function n() {
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
			}
			r.d(e, {
				Z: function () {
					return n;
				}
			});
		},
		1987: function (t, e, r) {
			'use strict';
			r.d(e, {
				Z: function () {
					return o;
				}
			});
			var n = r(6522),
				i = r(753);
			function o(t, e) {
				if (e && ('object' === (0, n.Z)(e) || 'function' === typeof e)) return e;
				if (void 0 !== e)
					throw new TypeError('Derived constructors may only return object or undefined');
				return (0, i.Z)(t);
			}
		},
		8960: function (t, e, r) {
			'use strict';
			function n(t, e) {
				return (
					(n =
						Object.setPrototypeOf ||
						function (t, e) {
							return ((t.__proto__ = e), t);
						}),
					n(t, e)
				);
			}
			r.d(e, {
				Z: function () {
					return n;
				}
			});
		},
		6522: function (t, e, r) {
			'use strict';
			function n(t) {
				return (
					(n =
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
					n(t)
				);
			}
			r.d(e, {
				Z: function () {
					return n;
				}
			});
		},
		3872: function (t, e, r) {
			'use strict';
			r.d(e, {
				go: function () {
					return ke;
				}
			});
			var n = r(6666);
			function i(t, e) {
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
			function o(t) {
				for (var e = 1; e < arguments.length; e++) {
					var r = null != arguments[e] ? arguments[e] : {};
					e % 2
						? i(Object(r), !0).forEach(function (e) {
								(0, n.Z)(t, e, r[e]);
							})
						: Object.getOwnPropertyDescriptors
							? Object.defineProperties(t, Object.getOwnPropertyDescriptors(r))
							: i(Object(r)).forEach(function (e) {
									Object.defineProperty(
										t,
										e,
										Object.getOwnPropertyDescriptor(r, e)
									);
								});
				}
				return t;
			}
			function a(t, e) {
				(null == e || e > t.length) && (e = t.length);
				for (var r = 0, n = new Array(e); r < e; r++) n[r] = t[r];
				return n;
			}
			function u(t, e) {
				if (t) {
					if ('string' === typeof t) return a(t, e);
					var r = Object.prototype.toString.call(t).slice(8, -1);
					return (
						'Object' === r && t.constructor && (r = t.constructor.name),
						'Map' === r || 'Set' === r
							? Array.from(t)
							: 'Arguments' === r ||
								  /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(r)
								? a(t, e)
								: void 0
					);
				}
			}
			function c(t, e) {
				return (
					(function (t) {
						if (Array.isArray(t)) return t;
					})(t) ||
					(function (t, e) {
						var r =
							null == t
								? null
								: ('undefined' !== typeof Symbol && t[Symbol.iterator]) ||
									t['@@iterator'];
						if (null != r) {
							var n,
								i,
								o = [],
								a = !0,
								u = !1;
							try {
								for (
									r = r.call(t);
									!(a = (n = r.next()).done) &&
									(o.push(n.value), !e || o.length !== e);
									a = !0
								);
							} catch (c) {
								((u = !0), (i = c));
							} finally {
								try {
									a || null == r.return || r.return();
								} finally {
									if (u) throw i;
								}
							}
							return o;
						}
					})(t, e) ||
					u(t, e) ||
					(function () {
						throw new TypeError(
							'Invalid attempt to destructure non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.'
						);
					})()
				);
			}
			var s = r(4795),
				f = r(5754),
				l = r(6906),
				h = r(5058),
				p = r(8960);
			var y = r(352);
			function d(t, e, r) {
				return (
					(d = (0, y.Z)()
						? Reflect.construct
						: function (t, e, r) {
								var n = [null];
								n.push.apply(n, e);
								var i = new (Function.bind.apply(t, n))();
								return (r && (0, p.Z)(i, r.prototype), i);
							}),
					d.apply(null, arguments)
				);
			}
			function g(t) {
				var e = 'function' === typeof Map ? new Map() : void 0;
				return (
					(g = function (t) {
						if (
							null === t ||
							((r = t), -1 === Function.toString.call(r).indexOf('[native code]'))
						)
							return t;
						var r;
						if ('function' !== typeof t)
							throw new TypeError(
								'Super expression must either be null or a function'
							);
						if ('undefined' !== typeof e) {
							if (e.has(t)) return e.get(t);
							e.set(t, n);
						}
						function n() {
							return d(t, arguments, (0, h.Z)(this).constructor);
						}
						return (
							(n.prototype = Object.create(t.prototype, {
								constructor: {
									value: n,
									enumerable: !1,
									writable: !0,
									configurable: !0
								}
							})),
							(0, p.Z)(n, t)
						);
					}),
					g(t)
				);
			}
			var v = r(7371),
				w = r(9249);
			function m(t) {
				return (
					(function (t) {
						if (Array.isArray(t)) return a(t);
					})(t) ||
					(function (t) {
						if (
							('undefined' !== typeof Symbol && null != t[Symbol.iterator]) ||
							null != t['@@iterator']
						)
							return Array.from(t);
					})(t) ||
					u(t) ||
					(function () {
						throw new TypeError(
							'Invalid attempt to spread non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.'
						);
					})()
				);
			}
			function b() {
				b = function () {
					return t;
				};
				var t = {},
					e = Object.prototype,
					r = e.hasOwnProperty,
					n = 'function' == typeof Symbol ? Symbol : {},
					i = n.iterator || '@@iterator',
					o = n.asyncIterator || '@@asyncIterator',
					a = n.toStringTag || '@@toStringTag';
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
				} catch (T) {
					u = function (t, e, r) {
						return (t[e] = r);
					};
				}
				function c(t, e, r, n) {
					var i = e && e.prototype instanceof l ? e : l,
						o = Object.create(i.prototype),
						a = new S(n || []);
					return (
						(o._invoke = (function (t, e, r) {
							var n = 'suspendedStart';
							return function (i, o) {
								if ('executing' === n)
									throw new Error('Generator is already running');
								if ('completed' === n) {
									if ('throw' === i) throw o;
									return O();
								}
								for (r.method = i, r.arg = o; ; ) {
									var a = r.delegate;
									if (a) {
										var u = x(a, r);
										if (u) {
											if (u === f) continue;
											return u;
										}
									}
									if ('next' === r.method) r.sent = r._sent = r.arg;
									else if ('throw' === r.method) {
										if ('suspendedStart' === n)
											throw ((n = 'completed'), r.arg);
										r.dispatchException(r.arg);
									} else 'return' === r.method && r.abrupt('return', r.arg);
									n = 'executing';
									var c = s(t, e, r);
									if ('normal' === c.type) {
										if (
											((n = r.done ? 'completed' : 'suspendedYield'),
											c.arg === f)
										)
											continue;
										return { value: c.arg, done: r.done };
									}
									'throw' === c.type &&
										((n = 'completed'), (r.method = 'throw'), (r.arg = c.arg));
								}
							};
						})(t, r, a)),
						o
					);
				}
				function s(t, e, r) {
					try {
						return { type: 'normal', arg: t.call(e, r) };
					} catch (T) {
						return { type: 'throw', arg: T };
					}
				}
				t.wrap = c;
				var f = {};
				function l() {}
				function h() {}
				function p() {}
				var y = {};
				u(y, i, function () {
					return this;
				});
				var d = Object.getPrototypeOf,
					g = d && d(d(L([])));
				g && g !== e && r.call(g, i) && (y = g);
				var v = (p.prototype = l.prototype = Object.create(y));
				function w(t) {
					['next', 'throw', 'return'].forEach(function (e) {
						u(t, e, function (t) {
							return this._invoke(e, t);
						});
					});
				}
				function m(t, e) {
					function n(i, o, a, u) {
						var c = s(t[i], t, o);
						if ('throw' !== c.type) {
							var f = c.arg,
								l = f.value;
							return l && 'object' == typeof l && r.call(l, '__await')
								? e.resolve(l.__await).then(
										function (t) {
											n('next', t, a, u);
										},
										function (t) {
											n('throw', t, a, u);
										}
									)
								: e.resolve(l).then(
										function (t) {
											((f.value = t), a(f));
										},
										function (t) {
											return n('throw', t, a, u);
										}
									);
						}
						u(c.arg);
					}
					var i;
					this._invoke = function (t, r) {
						function o() {
							return new e(function (e, i) {
								n(t, r, e, i);
							});
						}
						return (i = i ? i.then(o, o) : o());
					};
				}
				function x(t, e) {
					var r = t.iterator[e.method];
					if (void 0 === r) {
						if (((e.delegate = null), 'throw' === e.method)) {
							if (
								t.iterator.return &&
								((e.method = 'return'),
								(e.arg = void 0),
								x(t, e),
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
					var n = s(r, t.iterator, e.arg);
					if ('throw' === n.type)
						return ((e.method = 'throw'), (e.arg = n.arg), (e.delegate = null), f);
					var i = n.arg;
					return i
						? i.done
							? ((e[t.resultName] = i.value),
								(e.next = t.nextLoc),
								'return' !== e.method && ((e.method = 'next'), (e.arg = void 0)),
								(e.delegate = null),
								f)
							: i
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
					((this.tryEntries = [{ tryLoc: 'root' }]), t.forEach(k, this), this.reset(!0));
				}
				function L(t) {
					if (t) {
						var e = t[i];
						if (e) return e.call(t);
						if ('function' == typeof t.next) return t;
						if (!isNaN(t.length)) {
							var n = -1,
								o = function e() {
									for (; ++n < t.length; )
										if (r.call(t, n))
											return ((e.value = t[n]), (e.done = !1), e);
									return ((e.value = void 0), (e.done = !0), e);
								};
							return (o.next = o);
						}
					}
					return { next: O };
				}
				function O() {
					return { value: void 0, done: !0 };
				}
				return (
					(h.prototype = p),
					u(v, 'constructor', p),
					u(p, 'constructor', h),
					(h.displayName = u(p, a, 'GeneratorFunction')),
					(t.isGeneratorFunction = function (t) {
						var e = 'function' == typeof t && t.constructor;
						return (
							!!e && (e === h || 'GeneratorFunction' === (e.displayName || e.name))
						);
					}),
					(t.mark = function (t) {
						return (
							Object.setPrototypeOf
								? Object.setPrototypeOf(t, p)
								: ((t.__proto__ = p), u(t, a, 'GeneratorFunction')),
							(t.prototype = Object.create(v)),
							t
						);
					}),
					(t.awrap = function (t) {
						return { __await: t };
					}),
					w(m.prototype),
					u(m.prototype, o, function () {
						return this;
					}),
					(t.AsyncIterator = m),
					(t.async = function (e, r, n, i, o) {
						void 0 === o && (o = Promise);
						var a = new m(c(e, r, n, i), o);
						return t.isGeneratorFunction(r)
							? a
							: a.next().then(function (t) {
									return t.done ? t.value : a.next();
								});
					}),
					w(v),
					u(v, a, 'Generator'),
					u(v, i, function () {
						return this;
					}),
					u(v, 'toString', function () {
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
									(a.type = 'throw'),
									(a.arg = t),
									(e.next = r),
									n && ((e.method = 'next'), (e.arg = void 0)),
									!!n
								);
							}
							for (var i = this.tryEntries.length - 1; i >= 0; --i) {
								var o = this.tryEntries[i],
									a = o.completion;
								if ('root' === o.tryLoc) return n('end');
								if (o.tryLoc <= this.prev) {
									var u = r.call(o, 'catchLoc'),
										c = r.call(o, 'finallyLoc');
									if (u && c) {
										if (this.prev < o.catchLoc) return n(o.catchLoc, !0);
										if (this.prev < o.finallyLoc) return n(o.finallyLoc);
									} else if (u) {
										if (this.prev < o.catchLoc) return n(o.catchLoc, !0);
									} else {
										if (!c)
											throw new Error(
												'try statement without catch or finally'
											);
										if (this.prev < o.finallyLoc) return n(o.finallyLoc);
									}
								}
							}
						},
						abrupt: function (t, e) {
							for (var n = this.tryEntries.length - 1; n >= 0; --n) {
								var i = this.tryEntries[n];
								if (
									i.tryLoc <= this.prev &&
									r.call(i, 'finallyLoc') &&
									this.prev < i.finallyLoc
								) {
									var o = i;
									break;
								}
							}
							o &&
								('break' === t || 'continue' === t) &&
								o.tryLoc <= e &&
								e <= o.finallyLoc &&
								(o = null);
							var a = o ? o.completion : {};
							return (
								(a.type = t),
								(a.arg = e),
								o
									? ((this.method = 'next'), (this.next = o.finallyLoc), f)
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
										var i = n.arg;
										E(r);
									}
									return i;
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
			function x(t) {
				return function (e) {
					for (
						var r = arguments.length, n = new Array(r > 1 ? r - 1 : 0), i = 1;
						i < r;
						i++
					)
						n[i - 1] = arguments[i];
					return E(t, e, n);
				};
			}
			function k(t, e) {
				return x(S(t, e).get);
			}
			var E = Reflect.apply,
				S =
					(Reflect.construct,
					Reflect.defineProperty,
					Reflect.get,
					Reflect.getOwnPropertyDescriptor),
				L = Reflect.getPrototypeOf,
				O = (Reflect.has, Reflect.ownKeys),
				T = (Reflect.set, Reflect.setPrototypeOf, Proxy, Number),
				P = (T.isFinite, T.isNaN, Symbol.iterator),
				I = (Symbol.species, Symbol.toStringTag),
				_ = (Symbol.for, Object),
				A = _.create,
				G = _.defineProperty,
				D = (_.freeze, _.is, _.prototype),
				j = (D.__lookupGetter__ && x(D.__lookupGetter__), _.hasOwn || x(D.hasOwnProperty)),
				M = Array,
				F = (M.isArray, M.prototype),
				N = (x(F.join), x(F.push), x(F.toLocaleString), F[P]),
				U = x(N),
				C = (Math.trunc, ArrayBuffer),
				R = (C.isView, C.prototype),
				Z =
					(x(R.slice),
					k(R, 'byteLength'),
					'undefined' !== typeof SharedArrayBuffer ? SharedArrayBuffer : null),
				B = (Z && k(Z.prototype, 'byteLength'), L(Uint8Array)),
				V = (B.from, B.prototype),
				K =
					(V[P],
					x(V.keys),
					x(V.values),
					x(V.entries),
					x(V.set),
					x(V.reverse),
					x(V.fill),
					x(V.copyWithin),
					x(V.sort),
					x(V.slice),
					x(V.subarray),
					k(V, 'buffer'),
					k(V, 'byteOffset'),
					k(V, 'length'),
					k(V, I),
					Uint16Array,
					Uint32Array),
				W = Float32Array,
				H = L([][P]()),
				Y = x(H.next),
				q = x(
					b().mark(function t() {
						return b().wrap(function (t) {
							for (;;)
								switch ((t.prev = t.next)) {
									case 0:
									case 'end':
										return t.stop();
								}
						}, t);
					})().next
				),
				z = L(H),
				X = DataView.prototype,
				J = x(X.getUint16),
				Q = (x(X.setUint16), TypeError),
				$ = (RangeError, WeakSet.prototype),
				tt = (x($.add), x($.has), WeakMap),
				et = tt.prototype,
				rt = x(et.get),
				nt = (x(et.has), x(et.set)),
				it = new tt(),
				ot = A(
					null,
					(0, n.Z)(
						{
							next: {
								value: function () {
									var t = rt(it, this);
									return Y(t);
								}
							}
						},
						P,
						{
							value: function () {
								return this;
							}
						}
					)
				);
			function at(t) {
				if (t[P] === N) return t;
				var e = A(ot);
				return (nt(it, e, U(t)), e);
			}
			var ut,
				ct = new tt(),
				st = A(z, {
					next: {
						value: function () {
							var t = rt(ct, this);
							return q(t);
						},
						writable: !0,
						configurable: !0
					}
				}),
				ft = (function (t, e) {
					var r =
						('undefined' !== typeof Symbol && t[Symbol.iterator]) || t['@@iterator'];
					if (!r) {
						if (
							Array.isArray(t) ||
							(r = u(t)) ||
							(e && t && 'number' === typeof t.length)
						) {
							r && (t = r);
							var n = 0,
								i = function () {};
							return {
								s: i,
								n: function () {
									return n >= t.length
										? { done: !0 }
										: { done: !1, value: t[n++] };
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
					var o,
						a = !0,
						c = !1;
					return {
						s: function () {
							r = r.call(t);
						},
						n: function () {
							var t = r.next();
							return ((a = t.done), t);
						},
						e: function (t) {
							((c = !0), (o = t));
						},
						f: function () {
							try {
								a || null == r.return || r.return();
							} finally {
								if (c) throw o;
							}
						}
					};
				})(O(H));
			try {
				for (ft.s(); !(ut = ft.n()).done; ) {
					var lt = ut.value;
					'next' !== lt && G(st, lt, S(H, lt));
				}
			} catch (Se) {
				ft.e(Se);
			} finally {
				ft.f();
			}
			for (
				var ht = new C(4),
					pt = new W(ht),
					yt = new K(ht),
					dt = new K(512),
					gt = new K(512),
					vt = 0;
				vt < 256;
				++vt
			) {
				var wt = vt - 127;
				wt < -27
					? ((dt[vt] = 0), (dt[256 | vt] = 32768), (gt[vt] = 24), (gt[256 | vt] = 24))
					: wt < -14
						? ((dt[vt] = 1024 >> (-wt - 14)),
							(dt[256 | vt] = (1024 >> (-wt - 14)) | 32768),
							(gt[vt] = -wt - 1),
							(gt[256 | vt] = -wt - 1))
						: wt <= 15
							? ((dt[vt] = (wt + 15) << 10),
								(dt[256 | vt] = ((wt + 15) << 10) | 32768),
								(gt[vt] = 13),
								(gt[256 | vt] = 13))
							: wt < 128
								? ((dt[vt] = 31744),
									(dt[256 | vt] = 64512),
									(gt[vt] = 24),
									(gt[256 | vt] = 24))
								: ((dt[vt] = 31744),
									(dt[256 | vt] = 64512),
									(gt[vt] = 13),
									(gt[256 | vt] = 13));
			}
			for (var mt = new K(2048), bt = new K(64), xt = new K(64), kt = 1; kt < 1024; ++kt) {
				for (var Et = kt << 13, St = 0; 0 === (8388608 & Et); )
					((Et <<= 1), (St -= 8388608));
				((Et &= -8388609), (St += 947912704), (mt[kt] = Et | St));
			}
			for (var Lt = 1024; Lt < 2048; ++Lt) mt[Lt] = 939524096 + ((Lt - 1024) << 13);
			for (var Ot = 1; Ot < 31; ++Ot) bt[Ot] = Ot << 23;
			((bt[31] = 1199570944), (bt[32] = 2147483648));
			for (var Tt = 33; Tt < 63; ++Tt) bt[Tt] = 2147483648 + ((Tt - 32) << 23);
			bt[63] = 3347054592;
			for (var Pt = 1; Pt < 64; ++Pt) 32 !== Pt && (xt[Pt] = 1024);
			function It(t) {
				var e = t >> 10;
				return ((yt[0] = mt[xt[e] + (1023 & t)] + bt[e]), pt[0]);
			}
			function _t(t, e) {
				for (var r = arguments.length, n = new Array(r > 2 ? r - 2 : 0), i = 2; i < r; i++)
					n[i - 2] = arguments[i];
				return It(J.apply(void 0, [t, e].concat(m(at(n)))));
			}
			var At = r(9500),
				Gt = r(7185),
				Dt = r(6825);
			function jt(t, e) {
				for (
					var r, n = t.width, i = t.height, o = new Uint8Array(n * i * 3), a = 0, u = 0;
					a < t.length;
					++a, u += 3
				)
					((r = 256 - (t[a] / e) * 256), (o[u] = r), (o[u + 1] = r), (o[u + 2] = r));
				return o;
			}
			function Mt(t, e) {
				for (
					var r, n = t.width, i = t.height, o = new Uint8Array(n * i * 3), a = 0, u = 0;
					a < t.length;
					++a, u += 3
				)
					((r = (t[a] / e) * 256), (o[u] = r), (o[u + 1] = r), (o[u + 2] = r));
				return o;
			}
			function Ft(t, e) {
				for (
					var r = t.width,
						n = t.height,
						i = new Uint8Array(r * n * 3),
						o = e.length / 3,
						a = (e.length / 3) * 2,
						u = 0,
						c = 0;
					u < t.length;
					++u, c += 3
				) {
					var s = t[u];
					((i[c] = (e[s] / 65536) * 256),
						(i[c + 1] = (e[s + o] / 65536) * 256),
						(i[c + 2] = (e[s + a] / 65536) * 256));
				}
				return i;
			}
			function Nt(t) {
				for (
					var e = t.width, r = t.height, n = new Uint8Array(e * r * 3), i = 0, o = 0;
					i < t.length;
					i += 4, o += 3
				) {
					var a = t[i],
						u = t[i + 1],
						c = t[i + 2],
						s = t[i + 3];
					((n[o] = ((255 - a) / 256) * 255 * ((255 - s) / 256)),
						(n[o + 1] = ((255 - u) / 256) * 255 * ((255 - s) / 256)),
						(n[o + 2] = ((255 - c) / 256) * 255 * ((255 - s) / 256)));
				}
				return n;
			}
			function Ut(t) {
				for (
					var e = t.width,
						r = t.height,
						n = new Uint8ClampedArray(e * r * 3),
						i = 0,
						o = 0;
					i < t.length;
					i += 3, o += 3
				) {
					var a = t[i],
						u = t[i + 1],
						c = t[i + 2];
					((n[o] = a + 1.402 * (c - 128)),
						(n[o + 1] = a - 0.34414 * (u - 128) - 0.71414 * (c - 128)),
						(n[o + 2] = a + 1.772 * (u - 128)));
				}
				return n;
			}
			function Ct(t) {
				for (
					var e = t.width, r = t.height, n = new Uint8Array(e * r * 3), i = 0, o = 0;
					i < t.length;
					i += 3, o += 3
				) {
					var a = (t[i + 0] + 16) / 116,
						u = ((t[i + 1] << 24) >> 24) / 500 + a,
						c = a - ((t[i + 2] << 24) >> 24) / 200,
						s = void 0,
						f = void 0,
						l = void 0;
					((f =
						-0.9689 *
							(u =
								0.95047 *
								(u * u * u > 0.008856 ? u * u * u : (u - 16 / 116) / 7.787)) +
						1.8758 *
							(a = 1 * (a * a * a > 0.008856 ? a * a * a : (a - 16 / 116) / 7.787)) +
						0.0415 *
							(c =
								1.08883 *
								(c * c * c > 0.008856 ? c * c * c : (c - 16 / 116) / 7.787))),
						(l = 0.0557 * u + -0.204 * a + 1.057 * c),
						(s =
							(s = 3.2406 * u + -1.5372 * a + -0.4986 * c) > 0.0031308
								? 1.055 * Math.pow(s, 1 / 2.4) - 0.055
								: 12.92 * s),
						(f = f > 0.0031308 ? 1.055 * Math.pow(f, 1 / 2.4) - 0.055 : 12.92 * f),
						(l = l > 0.0031308 ? 1.055 * Math.pow(l, 1 / 2.4) - 0.055 : 12.92 * l),
						(n[o] = 255 * Math.max(0, Math.min(1, s))),
						(n[o + 1] = 255 * Math.max(0, Math.min(1, f))),
						(n[o + 2] = 255 * Math.max(0, Math.min(1, l))));
				}
				return n;
			}
			function Rt() {
				Rt = function () {
					return t;
				};
				var t = {},
					e = Object.prototype,
					r = e.hasOwnProperty,
					n = 'function' == typeof Symbol ? Symbol : {},
					i = n.iterator || '@@iterator',
					o = n.asyncIterator || '@@asyncIterator',
					a = n.toStringTag || '@@toStringTag';
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
				} catch (Se) {
					u = function (t, e, r) {
						return (t[e] = r);
					};
				}
				function c(t, e, r, n) {
					var i = e && e.prototype instanceof l ? e : l,
						o = Object.create(i.prototype),
						a = new E(n || []);
					return (
						(o._invoke = (function (t, e, r) {
							var n = 'suspendedStart';
							return function (i, o) {
								if ('executing' === n)
									throw new Error('Generator is already running');
								if ('completed' === n) {
									if ('throw' === i) throw o;
									return L();
								}
								for (r.method = i, r.arg = o; ; ) {
									var a = r.delegate;
									if (a) {
										var u = b(a, r);
										if (u) {
											if (u === f) continue;
											return u;
										}
									}
									if ('next' === r.method) r.sent = r._sent = r.arg;
									else if ('throw' === r.method) {
										if ('suspendedStart' === n)
											throw ((n = 'completed'), r.arg);
										r.dispatchException(r.arg);
									} else 'return' === r.method && r.abrupt('return', r.arg);
									n = 'executing';
									var c = s(t, e, r);
									if ('normal' === c.type) {
										if (
											((n = r.done ? 'completed' : 'suspendedYield'),
											c.arg === f)
										)
											continue;
										return { value: c.arg, done: r.done };
									}
									'throw' === c.type &&
										((n = 'completed'), (r.method = 'throw'), (r.arg = c.arg));
								}
							};
						})(t, r, a)),
						o
					);
				}
				function s(t, e, r) {
					try {
						return { type: 'normal', arg: t.call(e, r) };
					} catch (Se) {
						return { type: 'throw', arg: Se };
					}
				}
				t.wrap = c;
				var f = {};
				function l() {}
				function h() {}
				function p() {}
				var y = {};
				u(y, i, function () {
					return this;
				});
				var d = Object.getPrototypeOf,
					g = d && d(d(S([])));
				g && g !== e && r.call(g, i) && (y = g);
				var v = (p.prototype = l.prototype = Object.create(y));
				function w(t) {
					['next', 'throw', 'return'].forEach(function (e) {
						u(t, e, function (t) {
							return this._invoke(e, t);
						});
					});
				}
				function m(t, e) {
					function n(i, o, a, u) {
						var c = s(t[i], t, o);
						if ('throw' !== c.type) {
							var f = c.arg,
								l = f.value;
							return l && 'object' == typeof l && r.call(l, '__await')
								? e.resolve(l.__await).then(
										function (t) {
											n('next', t, a, u);
										},
										function (t) {
											n('throw', t, a, u);
										}
									)
								: e.resolve(l).then(
										function (t) {
											((f.value = t), a(f));
										},
										function (t) {
											return n('throw', t, a, u);
										}
									);
						}
						u(c.arg);
					}
					var i;
					this._invoke = function (t, r) {
						function o() {
							return new e(function (e, i) {
								n(t, r, e, i);
							});
						}
						return (i = i ? i.then(o, o) : o());
					};
				}
				function b(t, e) {
					var r = t.iterator[e.method];
					if (void 0 === r) {
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
					var n = s(r, t.iterator, e.arg);
					if ('throw' === n.type)
						return ((e.method = 'throw'), (e.arg = n.arg), (e.delegate = null), f);
					var i = n.arg;
					return i
						? i.done
							? ((e[t.resultName] = i.value),
								(e.next = t.nextLoc),
								'return' !== e.method && ((e.method = 'next'), (e.arg = void 0)),
								(e.delegate = null),
								f)
							: i
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
				function k(t) {
					var e = t.completion || {};
					((e.type = 'normal'), delete e.arg, (t.completion = e));
				}
				function E(t) {
					((this.tryEntries = [{ tryLoc: 'root' }]), t.forEach(x, this), this.reset(!0));
				}
				function S(t) {
					if (t) {
						var e = t[i];
						if (e) return e.call(t);
						if ('function' == typeof t.next) return t;
						if (!isNaN(t.length)) {
							var n = -1,
								o = function e() {
									for (; ++n < t.length; )
										if (r.call(t, n))
											return ((e.value = t[n]), (e.done = !1), e);
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
					(h.prototype = p),
					u(v, 'constructor', p),
					u(p, 'constructor', h),
					(h.displayName = u(p, a, 'GeneratorFunction')),
					(t.isGeneratorFunction = function (t) {
						var e = 'function' == typeof t && t.constructor;
						return (
							!!e && (e === h || 'GeneratorFunction' === (e.displayName || e.name))
						);
					}),
					(t.mark = function (t) {
						return (
							Object.setPrototypeOf
								? Object.setPrototypeOf(t, p)
								: ((t.__proto__ = p), u(t, a, 'GeneratorFunction')),
							(t.prototype = Object.create(v)),
							t
						);
					}),
					(t.awrap = function (t) {
						return { __await: t };
					}),
					w(m.prototype),
					u(m.prototype, o, function () {
						return this;
					}),
					(t.AsyncIterator = m),
					(t.async = function (e, r, n, i, o) {
						void 0 === o && (o = Promise);
						var a = new m(c(e, r, n, i), o);
						return t.isGeneratorFunction(r)
							? a
							: a.next().then(function (t) {
									return t.done ? t.value : a.next();
								});
					}),
					w(v),
					u(v, a, 'Generator'),
					u(v, i, function () {
						return this;
					}),
					u(v, 'toString', function () {
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
					(t.values = S),
					(E.prototype = {
						constructor: E,
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
							for (var i = this.tryEntries.length - 1; i >= 0; --i) {
								var o = this.tryEntries[i],
									a = o.completion;
								if ('root' === o.tryLoc) return n('end');
								if (o.tryLoc <= this.prev) {
									var u = r.call(o, 'catchLoc'),
										c = r.call(o, 'finallyLoc');
									if (u && c) {
										if (this.prev < o.catchLoc) return n(o.catchLoc, !0);
										if (this.prev < o.finallyLoc) return n(o.finallyLoc);
									} else if (u) {
										if (this.prev < o.catchLoc) return n(o.catchLoc, !0);
									} else {
										if (!c)
											throw new Error(
												'try statement without catch or finally'
											);
										if (this.prev < o.finallyLoc) return n(o.finallyLoc);
									}
								}
							}
						},
						abrupt: function (t, e) {
							for (var n = this.tryEntries.length - 1; n >= 0; --n) {
								var i = this.tryEntries[n];
								if (
									i.tryLoc <= this.prev &&
									r.call(i, 'finallyLoc') &&
									this.prev < i.finallyLoc
								) {
									var o = i;
									break;
								}
							}
							o &&
								('break' === t || 'continue' === t) &&
								o.tryLoc <= e &&
								e <= o.finallyLoc &&
								(o = null);
							var a = o ? o.completion : {};
							return (
								(a.type = t),
								(a.arg = e),
								o
									? ((this.method = 'next'), (this.next = o.finallyLoc), f)
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
								var r = this.tryEntries[e];
								if (r.finallyLoc === t)
									return (this.complete(r.completion, r.afterLoc), k(r), f);
							}
						},
						catch: function (t) {
							for (var e = this.tryEntries.length - 1; e >= 0; --e) {
								var r = this.tryEntries[e];
								if (r.tryLoc === t) {
									var n = r.completion;
									if ('throw' === n.type) {
										var i = n.arg;
										k(r);
									}
									return i;
								}
							}
							throw new Error('illegal catch attempt');
						},
						delegateYield: function (t, e, r) {
							return (
								(this.delegate = { iterator: S(t), resultName: e, nextLoc: r }),
								'next' === this.method && (this.arg = void 0),
								f
							);
						}
					}),
					t
				);
			}
			var Zt = new Map();
			function Bt(t, e) {
				(Array.isArray(t) || (t = [t]),
					t.forEach(function (t) {
						return Zt.set(t, e);
					}));
			}
			function Vt(t) {
				return Kt.apply(this, arguments);
			}
			function Kt() {
				return (Kt = (0, s.Z)(
					Rt().mark(function t(e) {
						var r, n;
						return Rt().wrap(function (t) {
							for (;;)
								switch ((t.prev = t.next)) {
									case 0:
										if ((r = Zt.get(e.Compression))) {
											t.next = 3;
											break;
										}
										throw new Error(
											'Unknown compression method identifier: '.concat(
												e.Compression
											)
										);
									case 3:
										return ((t.next = 5), r());
									case 5:
										return ((n = t.sent), t.abrupt('return', new n(e)));
									case 7:
									case 'end':
										return t.stop();
								}
						}, t);
					})
				)).apply(this, arguments);
			}
			function Wt(t, e, r) {
				var n = arguments.length > 3 && void 0 !== arguments[3] ? arguments[3] : 1;
				return new (Object.getPrototypeOf(t).constructor)(e * r * n);
			}
			function Ht(t, e, r, n, i) {
				var o = e / n,
					a = r / i;
				return t.map(function (t) {
					for (var u = Wt(t, n, i), c = 0; c < i; ++c)
						for (var s = Math.min(Math.round(a * c), r - 1), f = 0; f < n; ++f) {
							var l = Math.min(Math.round(o * f), e - 1),
								h = t[s * e + l];
							u[c * n + f] = h;
						}
					return u;
				});
			}
			function Yt(t, e, r) {
				return (1 - r) * t + r * e;
			}
			function qt(t, e, r, n, i) {
				var o = e / n,
					a = r / i;
				return t.map(function (t) {
					for (var u = Wt(t, n, i), c = 0; c < i; ++c)
						for (
							var s = a * c,
								f = Math.floor(s),
								l = Math.min(Math.ceil(s), r - 1),
								h = 0;
							h < n;
							++h
						) {
							var p = o * h,
								y = p % 1,
								d = Math.floor(p),
								g = Math.min(Math.ceil(p), e - 1),
								v = t[f * e + d],
								w = t[f * e + g],
								m = t[l * e + d],
								b = t[l * e + g],
								x = Yt(Yt(v, w, y), Yt(m, b, y), s % 1);
							u[c * n + h] = x;
						}
					return u;
				});
			}
			function zt(t, e, r, n, i) {
				var o = arguments.length > 5 && void 0 !== arguments[5] ? arguments[5] : 'nearest';
				switch (o.toLowerCase()) {
					case 'nearest':
						return Ht(t, e, r, n, i);
					case 'bilinear':
					case 'linear':
						return qt(t, e, r, n, i);
					default:
						throw new Error("Unsupported resampling method: '".concat(o, "'"));
				}
			}
			function Xt(t, e, r, n, i, o) {
				for (var a = e / n, u = r / i, c = Wt(t, n, i, o), s = 0; s < i; ++s)
					for (var f = Math.min(Math.round(u * s), r - 1), l = 0; l < n; ++l)
						for (var h = Math.min(Math.round(a * l), e - 1), p = 0; p < o; ++p) {
							var y = t[f * e * o + h * o + p];
							c[s * n * o + l * o + p] = y;
						}
				return c;
			}
			function Jt(t, e, r, n, i, o) {
				for (var a = e / n, u = r / i, c = Wt(t, n, i, o), s = 0; s < i; ++s)
					for (
						var f = u * s, l = Math.floor(f), h = Math.min(Math.ceil(f), r - 1), p = 0;
						p < n;
						++p
					)
						for (
							var y = a * p,
								d = y % 1,
								g = Math.floor(y),
								v = Math.min(Math.ceil(y), e - 1),
								w = 0;
							w < o;
							++w
						) {
							var m = t[l * e * o + g * o + w],
								b = t[l * e * o + v * o + w],
								x = t[h * e * o + g * o + w],
								k = t[h * e * o + v * o + w],
								E = Yt(Yt(m, b, d), Yt(x, k, d), f % 1);
							c[s * n * o + p * o + w] = E;
						}
				return c;
			}
			function Qt(t, e, r, n, i, o) {
				var a = arguments.length > 6 && void 0 !== arguments[6] ? arguments[6] : 'nearest';
				switch (a.toLowerCase()) {
					case 'nearest':
						return Xt(t, e, r, n, i, o);
					case 'bilinear':
					case 'linear':
						return Jt(t, e, r, n, i, o);
					default:
						throw new Error("Unsupported resampling method: '".concat(a, "'"));
				}
			}
			function $t() {
				$t = function () {
					return t;
				};
				var t = {},
					e = Object.prototype,
					r = e.hasOwnProperty,
					n = 'function' == typeof Symbol ? Symbol : {},
					i = n.iterator || '@@iterator',
					o = n.asyncIterator || '@@asyncIterator',
					a = n.toStringTag || '@@toStringTag';
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
				} catch (Se) {
					u = function (t, e, r) {
						return (t[e] = r);
					};
				}
				function c(t, e, r, n) {
					var i = e && e.prototype instanceof l ? e : l,
						o = Object.create(i.prototype),
						a = new E(n || []);
					return (
						(o._invoke = (function (t, e, r) {
							var n = 'suspendedStart';
							return function (i, o) {
								if ('executing' === n)
									throw new Error('Generator is already running');
								if ('completed' === n) {
									if ('throw' === i) throw o;
									return L();
								}
								for (r.method = i, r.arg = o; ; ) {
									var a = r.delegate;
									if (a) {
										var u = b(a, r);
										if (u) {
											if (u === f) continue;
											return u;
										}
									}
									if ('next' === r.method) r.sent = r._sent = r.arg;
									else if ('throw' === r.method) {
										if ('suspendedStart' === n)
											throw ((n = 'completed'), r.arg);
										r.dispatchException(r.arg);
									} else 'return' === r.method && r.abrupt('return', r.arg);
									n = 'executing';
									var c = s(t, e, r);
									if ('normal' === c.type) {
										if (
											((n = r.done ? 'completed' : 'suspendedYield'),
											c.arg === f)
										)
											continue;
										return { value: c.arg, done: r.done };
									}
									'throw' === c.type &&
										((n = 'completed'), (r.method = 'throw'), (r.arg = c.arg));
								}
							};
						})(t, r, a)),
						o
					);
				}
				function s(t, e, r) {
					try {
						return { type: 'normal', arg: t.call(e, r) };
					} catch (Se) {
						return { type: 'throw', arg: Se };
					}
				}
				t.wrap = c;
				var f = {};
				function l() {}
				function h() {}
				function p() {}
				var y = {};
				u(y, i, function () {
					return this;
				});
				var d = Object.getPrototypeOf,
					g = d && d(d(S([])));
				g && g !== e && r.call(g, i) && (y = g);
				var v = (p.prototype = l.prototype = Object.create(y));
				function w(t) {
					['next', 'throw', 'return'].forEach(function (e) {
						u(t, e, function (t) {
							return this._invoke(e, t);
						});
					});
				}
				function m(t, e) {
					function n(i, o, a, u) {
						var c = s(t[i], t, o);
						if ('throw' !== c.type) {
							var f = c.arg,
								l = f.value;
							return l && 'object' == typeof l && r.call(l, '__await')
								? e.resolve(l.__await).then(
										function (t) {
											n('next', t, a, u);
										},
										function (t) {
											n('throw', t, a, u);
										}
									)
								: e.resolve(l).then(
										function (t) {
											((f.value = t), a(f));
										},
										function (t) {
											return n('throw', t, a, u);
										}
									);
						}
						u(c.arg);
					}
					var i;
					this._invoke = function (t, r) {
						function o() {
							return new e(function (e, i) {
								n(t, r, e, i);
							});
						}
						return (i = i ? i.then(o, o) : o());
					};
				}
				function b(t, e) {
					var r = t.iterator[e.method];
					if (void 0 === r) {
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
					var n = s(r, t.iterator, e.arg);
					if ('throw' === n.type)
						return ((e.method = 'throw'), (e.arg = n.arg), (e.delegate = null), f);
					var i = n.arg;
					return i
						? i.done
							? ((e[t.resultName] = i.value),
								(e.next = t.nextLoc),
								'return' !== e.method && ((e.method = 'next'), (e.arg = void 0)),
								(e.delegate = null),
								f)
							: i
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
				function k(t) {
					var e = t.completion || {};
					((e.type = 'normal'), delete e.arg, (t.completion = e));
				}
				function E(t) {
					((this.tryEntries = [{ tryLoc: 'root' }]), t.forEach(x, this), this.reset(!0));
				}
				function S(t) {
					if (t) {
						var e = t[i];
						if (e) return e.call(t);
						if ('function' == typeof t.next) return t;
						if (!isNaN(t.length)) {
							var n = -1,
								o = function e() {
									for (; ++n < t.length; )
										if (r.call(t, n))
											return ((e.value = t[n]), (e.done = !1), e);
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
					(h.prototype = p),
					u(v, 'constructor', p),
					u(p, 'constructor', h),
					(h.displayName = u(p, a, 'GeneratorFunction')),
					(t.isGeneratorFunction = function (t) {
						var e = 'function' == typeof t && t.constructor;
						return (
							!!e && (e === h || 'GeneratorFunction' === (e.displayName || e.name))
						);
					}),
					(t.mark = function (t) {
						return (
							Object.setPrototypeOf
								? Object.setPrototypeOf(t, p)
								: ((t.__proto__ = p), u(t, a, 'GeneratorFunction')),
							(t.prototype = Object.create(v)),
							t
						);
					}),
					(t.awrap = function (t) {
						return { __await: t };
					}),
					w(m.prototype),
					u(m.prototype, o, function () {
						return this;
					}),
					(t.AsyncIterator = m),
					(t.async = function (e, r, n, i, o) {
						void 0 === o && (o = Promise);
						var a = new m(c(e, r, n, i), o);
						return t.isGeneratorFunction(r)
							? a
							: a.next().then(function (t) {
									return t.done ? t.value : a.next();
								});
					}),
					w(v),
					u(v, a, 'Generator'),
					u(v, i, function () {
						return this;
					}),
					u(v, 'toString', function () {
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
					(t.values = S),
					(E.prototype = {
						constructor: E,
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
							for (var i = this.tryEntries.length - 1; i >= 0; --i) {
								var o = this.tryEntries[i],
									a = o.completion;
								if ('root' === o.tryLoc) return n('end');
								if (o.tryLoc <= this.prev) {
									var u = r.call(o, 'catchLoc'),
										c = r.call(o, 'finallyLoc');
									if (u && c) {
										if (this.prev < o.catchLoc) return n(o.catchLoc, !0);
										if (this.prev < o.finallyLoc) return n(o.finallyLoc);
									} else if (u) {
										if (this.prev < o.catchLoc) return n(o.catchLoc, !0);
									} else {
										if (!c)
											throw new Error(
												'try statement without catch or finally'
											);
										if (this.prev < o.finallyLoc) return n(o.finallyLoc);
									}
								}
							}
						},
						abrupt: function (t, e) {
							for (var n = this.tryEntries.length - 1; n >= 0; --n) {
								var i = this.tryEntries[n];
								if (
									i.tryLoc <= this.prev &&
									r.call(i, 'finallyLoc') &&
									this.prev < i.finallyLoc
								) {
									var o = i;
									break;
								}
							}
							o &&
								('break' === t || 'continue' === t) &&
								o.tryLoc <= e &&
								e <= o.finallyLoc &&
								(o = null);
							var a = o ? o.completion : {};
							return (
								(a.type = t),
								(a.arg = e),
								o
									? ((this.method = 'next'), (this.next = o.finallyLoc), f)
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
								var r = this.tryEntries[e];
								if (r.finallyLoc === t)
									return (this.complete(r.completion, r.afterLoc), k(r), f);
							}
						},
						catch: function (t) {
							for (var e = this.tryEntries.length - 1; e >= 0; --e) {
								var r = this.tryEntries[e];
								if (r.tryLoc === t) {
									var n = r.completion;
									if ('throw' === n.type) {
										var i = n.arg;
										k(r);
									}
									return i;
								}
							}
							throw new Error('illegal catch attempt');
						},
						delegateYield: function (t, e, r) {
							return (
								(this.delegate = { iterator: S(t), resultName: e, nextLoc: r }),
								'next' === this.method && (this.arg = void 0),
								f
							);
						}
					}),
					t
				);
			}
			function te(t, e, r) {
				for (var n = 0, i = e; i < r; ++i) n += t[i];
				return n;
			}
			function ee(t, e, r) {
				switch (t) {
					case 1:
						if (e <= 8) return new Uint8Array(r);
						if (e <= 16) return new Uint16Array(r);
						if (e <= 32) return new Uint32Array(r);
						break;
					case 2:
						if (8 === e) return new Int8Array(r);
						if (16 === e) return new Int16Array(r);
						if (32 === e) return new Int32Array(r);
						break;
					case 3:
						switch (e) {
							case 16:
							case 32:
								return new Float32Array(r);
							case 64:
								return new Float64Array(r);
						}
				}
				throw Error('Unsupported data format/bitsPerSample');
			}
			function re(t, e) {
				return (
					((1 !== t && 2 !== t) || !(e <= 32) || e % 8 !== 0) &&
					(3 !== t || (16 !== e && 32 !== e && 64 !== e))
				);
			}
			function ne(t, e, r, n, i, o, a) {
				var u = new DataView(t),
					c = 2 === r ? 1 : n,
					s = ee(e, i, 2 === r ? a * o : a * o * n),
					f = parseInt('1'.repeat(i), 2);
				if (1 === e) {
					var l = o * (1 === r ? n * i : i);
					0 !== (7 & l) && (l = (l + 7) & -8);
					for (var h = 0; h < a; ++h)
						for (var p = h * l, y = 0; y < o; ++y)
							for (var d = p + y * c * i, g = 0; g < c; ++g) {
								var v = d + g * i,
									w = (h * o + y) * c + g,
									m = Math.floor(v / 8),
									b = v % 8;
								if (b + i <= 8) s[w] = (u.getUint8(m) >> (8 - i - b)) & f;
								else if (b + i <= 16) s[w] = (u.getUint16(m) >> (16 - i - b)) & f;
								else if (b + i <= 24) {
									var x = (u.getUint16(m) << 8) | u.getUint8(m + 2);
									s[w] = (x >> (24 - i - b)) & f;
								} else s[w] = (u.getUint32(m) >> (32 - i - b)) & f;
							}
				}
				return s.buffer;
			}
			(Bt([void 0, 1], function () {
				return r
					.e(943)
					.then(r.bind(r, 1943))
					.then(function (t) {
						return t.default;
					});
			}),
				Bt(5, function () {
					return r
						.e(425)
						.then(r.bind(r, 4425))
						.then(function (t) {
							return t.default;
						});
				}),
				Bt(6, function () {
					throw new Error('old style JPEG compression is not supported.');
				}),
				Bt(7, function () {
					return r
						.e(379)
						.then(r.bind(r, 7379))
						.then(function (t) {
							return t.default;
						});
				}),
				Bt([8, 32946], function () {
					return Promise.all([r.e(981), r.e(559)])
						.then(r.bind(r, 6559))
						.then(function (t) {
							return t.default;
						});
				}),
				Bt(32773, function () {
					return r
						.e(787)
						.then(r.bind(r, 4787))
						.then(function (t) {
							return t.default;
						});
				}),
				Bt(34887, function () {
					return Promise.all([r.e(981), r.e(762)])
						.then(r.bind(r, 1762))
						.then(function (t) {
							return t.default;
						});
				}),
				Bt(50001, function () {
					return r
						.e(592)
						.then(r.bind(r, 3592))
						.then(function (t) {
							return t.default;
						});
				}));
			var ie = (function () {
					function t(e, r, n, i, o, a) {
						((0, w.Z)(this, t),
							(this.fileDirectory = e),
							(this.geoKeys = r),
							(this.dataView = n),
							(this.littleEndian = i),
							(this.tiles = o ? {} : null),
							(this.isTiled = !e.StripOffsets));
						var u = e.PlanarConfiguration;
						if (
							((this.planarConfiguration = 'undefined' === typeof u ? 1 : u),
							1 !== this.planarConfiguration && 2 !== this.planarConfiguration)
						)
							throw new Error('Invalid planar configuration.');
						this.source = a;
					}
					return (
						(0, v.Z)(t, [
							{
								key: 'getFileDirectory',
								value: function () {
									return this.fileDirectory;
								}
							},
							{
								key: 'getGeoKeys',
								value: function () {
									return this.geoKeys;
								}
							},
							{
								key: 'getWidth',
								value: function () {
									return this.fileDirectory.ImageWidth;
								}
							},
							{
								key: 'getHeight',
								value: function () {
									return this.fileDirectory.ImageLength;
								}
							},
							{
								key: 'getSamplesPerPixel',
								value: function () {
									return 'undefined' !== typeof this.fileDirectory.SamplesPerPixel
										? this.fileDirectory.SamplesPerPixel
										: 1;
								}
							},
							{
								key: 'getTileWidth',
								value: function () {
									return this.isTiled
										? this.fileDirectory.TileWidth
										: this.getWidth();
								}
							},
							{
								key: 'getTileHeight',
								value: function () {
									return this.isTiled
										? this.fileDirectory.TileLength
										: 'undefined' !== typeof this.fileDirectory.RowsPerStrip
											? Math.min(
													this.fileDirectory.RowsPerStrip,
													this.getHeight()
												)
											: this.getHeight();
								}
							},
							{
								key: 'getBlockWidth',
								value: function () {
									return this.getTileWidth();
								}
							},
							{
								key: 'getBlockHeight',
								value: function (t) {
									return this.isTiled ||
										(t + 1) * this.getTileHeight() <= this.getHeight()
										? this.getTileHeight()
										: this.getHeight() - t * this.getTileHeight();
								}
							},
							{
								key: 'getBytesPerPixel',
								value: function () {
									for (
										var t = 0, e = 0;
										e < this.fileDirectory.BitsPerSample.length;
										++e
									)
										t += this.getSampleByteSize(e);
									return t;
								}
							},
							{
								key: 'getSampleByteSize',
								value: function (t) {
									if (t >= this.fileDirectory.BitsPerSample.length)
										throw new RangeError(
											'Sample index '.concat(t, ' is out of range.')
										);
									return Math.ceil(this.fileDirectory.BitsPerSample[t] / 8);
								}
							},
							{
								key: 'getReaderForSample',
								value: function (t) {
									var e = this.fileDirectory.SampleFormat
											? this.fileDirectory.SampleFormat[t]
											: 1,
										r = this.fileDirectory.BitsPerSample[t];
									switch (e) {
										case 1:
											if (r <= 8) return DataView.prototype.getUint8;
											if (r <= 16) return DataView.prototype.getUint16;
											if (r <= 32) return DataView.prototype.getUint32;
											break;
										case 2:
											if (r <= 8) return DataView.prototype.getInt8;
											if (r <= 16) return DataView.prototype.getInt16;
											if (r <= 32) return DataView.prototype.getInt32;
											break;
										case 3:
											switch (r) {
												case 16:
													return function (t, e) {
														return _t(this, t, e);
													};
												case 32:
													return DataView.prototype.getFloat32;
												case 64:
													return DataView.prototype.getFloat64;
											}
									}
									throw Error('Unsupported data format/bitsPerSample');
								}
							},
							{
								key: 'getSampleFormat',
								value: function () {
									var t =
										arguments.length > 0 && void 0 !== arguments[0]
											? arguments[0]
											: 0;
									return this.fileDirectory.SampleFormat
										? this.fileDirectory.SampleFormat[t]
										: 1;
								}
							},
							{
								key: 'getBitsPerSample',
								value: function () {
									var t =
										arguments.length > 0 && void 0 !== arguments[0]
											? arguments[0]
											: 0;
									return this.fileDirectory.BitsPerSample[t];
								}
							},
							{
								key: 'getArrayForSample',
								value: function (t, e) {
									return ee(this.getSampleFormat(t), this.getBitsPerSample(t), e);
								}
							},
							{
								key: 'getTileOrStrip',
								value: (function () {
									var t = (0, s.Z)(
										$t().mark(function t(e, r, n, i, o) {
											var a,
												u,
												c,
												f,
												l,
												h,
												p,
												y,
												d = this;
											return $t().wrap(
												function (t) {
													for (;;)
														switch ((t.prev = t.next)) {
															case 0:
																return (
																	(a = Math.ceil(
																		this.getWidth() /
																			this.getTileWidth()
																	)),
																	(u = Math.ceil(
																		this.getHeight() /
																			this.getTileHeight()
																	)),
																	(f = this.tiles),
																	1 === this.planarConfiguration
																		? (c = r * a + e)
																		: 2 ===
																				this
																					.planarConfiguration &&
																			(c =
																				n * a * u +
																				r * a +
																				e),
																	this.isTiled
																		? ((l =
																				this.fileDirectory
																					.TileOffsets[
																					c
																				]),
																			(h =
																				this.fileDirectory
																					.TileByteCounts[
																					c
																				]))
																		: ((l =
																				this.fileDirectory
																					.StripOffsets[
																					c
																				]),
																			(h =
																				this.fileDirectory
																					.StripByteCounts[
																					c
																				])),
																	(t.next = 7),
																	this.source.fetch(
																		[{ offset: l, length: h }],
																		o
																	)
																);
															case 7:
																return (
																	(p = t.sent[0]),
																	null !== f && f[c]
																		? (y = f[c])
																		: ((y = (0, s.Z)(
																				$t().mark(
																					function t() {
																						var e, n, o;
																						return $t().wrap(
																							function (
																								t
																							) {
																								for (;;)
																									switch (
																										(t.prev =
																											t.next)
																									) {
																										case 0:
																											return (
																												(t.next = 2),
																												i.decode(
																													d.fileDirectory,
																													p
																												)
																											);
																										case 2:
																											return (
																												(e =
																													t.sent),
																												(n =
																													d.getSampleFormat()),
																												(o =
																													d.getBitsPerSample()),
																												re(
																													n,
																													o
																												) &&
																													(e =
																														ne(
																															e,
																															n,
																															d.planarConfiguration,
																															d.getSamplesPerPixel(),
																															o,
																															d.getTileWidth(),
																															d.getBlockHeight(
																																r
																															)
																														)),
																												t.abrupt(
																													'return',
																													e
																												)
																											);
																										case 7:
																										case 'end':
																											return t.stop();
																									}
																							},
																							t
																						);
																					}
																				)
																			)()),
																			null !== f &&
																				(f[c] = y)),
																	(t.t0 = e),
																	(t.t1 = r),
																	(t.t2 = n),
																	(t.next = 14),
																	y
																);
															case 14:
																return (
																	(t.t3 = t.sent),
																	t.abrupt('return', {
																		x: t.t0,
																		y: t.t1,
																		sample: t.t2,
																		data: t.t3
																	})
																);
															case 16:
															case 'end':
																return t.stop();
														}
												},
												t,
												this
											);
										})
									);
									return function (e, r, n, i, o) {
										return t.apply(this, arguments);
									};
								})()
							},
							{
								key: '_readRaster',
								value: (function () {
									var t = (0, s.Z)(
										$t().mark(function t(e, r, n, i, o, a, u, c, s) {
											var f,
												l,
												h,
												p,
												y,
												d,
												g,
												v,
												w,
												m,
												b,
												x,
												k,
												E,
												S,
												L,
												O,
												T,
												P,
												I,
												_ = this;
											return $t().wrap(
												function (t) {
													for (;;)
														switch ((t.prev = t.next)) {
															case 0:
																for (
																	f = this.getTileWidth(),
																		l = this.getTileHeight(),
																		h = this.getWidth(),
																		p = this.getHeight(),
																		y = Math.max(
																			Math.floor(e[0] / f),
																			0
																		),
																		d = Math.min(
																			Math.ceil(e[2] / f),
																			Math.ceil(h / f)
																		),
																		g = Math.max(
																			Math.floor(e[1] / l),
																			0
																		),
																		v = Math.min(
																			Math.ceil(e[3] / l),
																			Math.ceil(p / l)
																		),
																		w = e[2] - e[0],
																		m = this.getBytesPerPixel(),
																		b = [],
																		x = [],
																		k = 0;
																	k < r.length;
																	++k
																)
																	(1 === this.planarConfiguration
																		? b.push(
																				te(
																					this
																						.fileDirectory
																						.BitsPerSample,
																					0,
																					r[k]
																				) / 8
																			)
																		: b.push(0),
																		x.push(
																			this.getReaderForSample(
																				r[k]
																			)
																		));
																for (
																	E = [],
																		S = this.littleEndian,
																		L = g;
																	L < v;
																	++L
																)
																	for (O = y; O < d; ++O)
																		for (
																			T = function (t) {
																				var a = t,
																					u = r[t];
																				2 ===
																					_.planarConfiguration &&
																					(m =
																						_.getSampleByteSize(
																							t
																						));
																				var c =
																					_.getTileOrStrip(
																						O,
																						L,
																						u,
																						o,
																						s
																					);
																				(E.push(c),
																					c.then(
																						function (
																							t
																						) {
																							for (
																								var o =
																										t.data,
																									u =
																										new DataView(
																											o
																										),
																									c =
																										_.getBlockHeight(
																											t.y
																										),
																									s =
																										t.y *
																										l,
																									y =
																										t.x *
																										f,
																									d =
																										s +
																										c,
																									g =
																										(t.x +
																											1) *
																										f,
																									v =
																										x[
																											a
																										],
																									k =
																										Math.min(
																											c,
																											c -
																												(d -
																													e[3]),
																											p -
																												s
																										),
																									E =
																										Math.min(
																											f,
																											f -
																												(g -
																													e[2]),
																											h -
																												y
																										),
																									L =
																										Math.max(
																											0,
																											e[1] -
																												s
																										);
																								L <
																								k;
																								++L
																							)
																								for (
																									var O =
																										Math.max(
																											0,
																											e[0] -
																												y
																										);
																									O <
																									E;
																									++O
																								) {
																									var T =
																											(L *
																												f +
																												O) *
																											m,
																										P =
																											v.call(
																												u,
																												T +
																													b[
																														a
																													],
																												S
																											),
																										I =
																											void 0;
																									i
																										? ((I =
																												(L +
																													s -
																													e[1]) *
																													w *
																													r.length +
																												(O +
																													y -
																													e[0]) *
																													r.length +
																												a),
																											(n[
																												I
																											] =
																												P))
																										: ((I =
																												(L +
																													s -
																													e[1]) *
																													w +
																												O +
																												y -
																												e[0]),
																											(n[
																												a
																											][
																												I
																											] =
																												P));
																								}
																						}
																					));
																			},
																				P = 0;
																			P < r.length;
																			++P
																		)
																			T(P);
																return (
																	(t.next = 18),
																	Promise.all(E)
																);
															case 18:
																if (
																	!(
																		(a && e[2] - e[0] !== a) ||
																		(u && e[3] - e[1] !== u)
																	)
																) {
																	t.next = 23;
																	break;
																}
																return (
																	((I = i
																		? Qt(
																				n,
																				e[2] - e[0],
																				e[3] - e[1],
																				a,
																				u,
																				r.length,
																				c
																			)
																		: zt(
																				n,
																				e[2] - e[0],
																				e[3] - e[1],
																				a,
																				u,
																				c
																			)).width = a),
																	(I.height = u),
																	t.abrupt('return', I)
																);
															case 23:
																return (
																	(n.width = a || e[2] - e[0]),
																	(n.height = u || e[3] - e[1]),
																	t.abrupt('return', n)
																);
															case 26:
															case 'end':
																return t.stop();
														}
												},
												t,
												this
											);
										})
									);
									return function (e, r, n, i, o, a, u, c, s) {
										return t.apply(this, arguments);
									};
								})()
							},
							{
								key: 'readRasters',
								value: (function () {
									var t = (0, s.Z)(
										$t().mark(function t() {
											var e,
												r,
												n,
												i,
												o,
												a,
												u,
												c,
												s,
												f,
												l,
												h,
												p,
												y,
												d,
												g,
												v,
												w,
												m,
												b,
												x,
												k,
												E,
												S,
												L,
												O,
												T = arguments;
											return $t().wrap(
												function (t) {
													for (;;)
														switch ((t.prev = t.next)) {
															case 0:
																if (
																	((e =
																		T.length > 0 &&
																		void 0 !== T[0]
																			? T[0]
																			: {}),
																	(r = e.window),
																	(n = e.samples),
																	(i = void 0 === n ? [] : n),
																	(o = e.interleave),
																	(a = e.pool),
																	(u = void 0 === a ? null : a),
																	(c = e.width),
																	(s = e.height),
																	(f = e.resampleMethod),
																	(l = e.fillValue),
																	(h = e.signal),
																	!(
																		(p = r || [
																			0,
																			0,
																			this.getWidth(),
																			this.getHeight()
																		])[0] > p[2] || p[1] > p[3]
																	))
																) {
																	t.next = 4;
																	break;
																}
																throw new Error('Invalid subsets');
															case 4:
																if (
																	((y = p[2] - p[0]),
																	(d = p[3] - p[1]),
																	(g = y * d),
																	(v = this.getSamplesPerPixel()),
																	i && i.length)
																) {
																	t.next = 12;
																	break;
																}
																for (w = 0; w < v; ++w) i.push(w);
																t.next = 19;
																break;
															case 12:
																m = 0;
															case 13:
																if (!(m < i.length)) {
																	t.next = 19;
																	break;
																}
																if (!(i[m] >= v)) {
																	t.next = 16;
																	break;
																}
																return t.abrupt(
																	'return',
																	Promise.reject(
																		new RangeError(
																			"Invalid sample index '".concat(
																				i[m],
																				"'."
																			)
																		)
																	)
																);
															case 16:
																(++m, (t.next = 13));
																break;
															case 19:
																if (o)
																	((x = this.fileDirectory
																		.SampleFormat
																		? Math.max.apply(
																				null,
																				this.fileDirectory
																					.SampleFormat
																			)
																		: 1),
																		(k = Math.max.apply(
																			null,
																			this.fileDirectory
																				.BitsPerSample
																		)),
																		(b = ee(
																			x,
																			k,
																			g * i.length
																		)),
																		l && b.fill(l));
																else
																	for (
																		b = [], E = 0;
																		E < i.length;
																		++E
																	)
																		((S =
																			this.getArrayForSample(
																				i[E],
																				g
																			)),
																			Array.isArray(l) &&
																			E < l.length
																				? S.fill(l[E])
																				: l &&
																					!Array.isArray(
																						l
																					) &&
																					S.fill(l),
																			b.push(S));
																if (((t.t0 = u), t.t0)) {
																	t.next = 25;
																	break;
																}
																return (
																	(t.next = 24),
																	Vt(this.fileDirectory)
																);
															case 24:
																t.t0 = t.sent;
															case 25:
																return (
																	(L = t.t0),
																	(t.next = 28),
																	this._readRaster(
																		p,
																		i,
																		b,
																		o,
																		L,
																		c,
																		s,
																		f,
																		h
																	)
																);
															case 28:
																return (
																	(O = t.sent),
																	t.abrupt('return', O)
																);
															case 30:
															case 'end':
																return t.stop();
														}
												},
												t,
												this
											);
										})
									);
									return function () {
										return t.apply(this, arguments);
									};
								})()
							},
							{
								key: 'readRGB',
								value: (function () {
									var t = (0, s.Z)(
										$t().mark(function t() {
											var e,
												r,
												n,
												i,
												o,
												a,
												u,
												c,
												s,
												f,
												l,
												h,
												p,
												y,
												d,
												g,
												v,
												w,
												m,
												b,
												x,
												k,
												E,
												S,
												L,
												O,
												T = arguments;
											return $t().wrap(
												function (t) {
													for (;;)
														switch ((t.prev = t.next)) {
															case 0:
																if (
																	((e =
																		T.length > 0 &&
																		void 0 !== T[0]
																			? T[0]
																			: {}),
																	(r = e.window),
																	(n = e.interleave),
																	(i = void 0 === n || n),
																	(o = e.pool),
																	(a = void 0 === o ? null : o),
																	(u = e.width),
																	(c = e.height),
																	(s = e.resampleMethod),
																	(f = e.enableAlpha),
																	(l = void 0 !== f && f),
																	(h = e.signal),
																	!(
																		(p = r || [
																			0,
																			0,
																			this.getWidth(),
																			this.getHeight()
																		])[0] > p[2] || p[1] > p[3]
																	))
																) {
																	t.next = 4;
																	break;
																}
																throw new Error('Invalid subsets');
															case 4:
																if (
																	(y =
																		this.fileDirectory
																			.PhotometricInterpretation) !==
																	Dt.Ie.RGB
																) {
																	t.next = 9;
																	break;
																}
																if (
																	((d = [0, 1, 2]),
																	this.fileDirectory
																		.ExtraSamples !==
																		Dt.pd.Unspecified && l)
																)
																	for (
																		d = [], g = 0;
																		g <
																		this.fileDirectory
																			.BitsPerSample.length;
																		g += 1
																	)
																		d.push(g);
																return t.abrupt(
																	'return',
																	this.readRasters({
																		window: r,
																		interleave: i,
																		samples: d,
																		pool: a,
																		width: u,
																		height: c,
																		resampleMethod: s,
																		signal: h
																	})
																);
															case 9:
																((t.t0 = y),
																	(t.next =
																		t.t0 ===
																			Dt.Ie.WhiteIsZero ||
																		t.t0 ===
																			Dt.Ie.BlackIsZero ||
																		t.t0 === Dt.Ie.Palette
																			? 12
																			: t.t0 === Dt.Ie.CMYK
																				? 14
																				: t.t0 ===
																							Dt.Ie
																								.YCbCr ||
																					  t.t0 ===
																							Dt.Ie
																								.CIELab
																					? 16
																					: 18));
																break;
															case 12:
																return (
																	(v = [0]),
																	t.abrupt('break', 19)
																);
															case 14:
																return (
																	(v = [0, 1, 2, 3]),
																	t.abrupt('break', 19)
																);
															case 16:
																return (
																	(v = [0, 1, 2]),
																	t.abrupt('break', 19)
																);
															case 18:
																throw new Error(
																	'Invalid or unsupported photometric interpretation.'
																);
															case 19:
																return (
																	(w = {
																		window: p,
																		interleave: !0,
																		samples: v,
																		pool: a,
																		width: u,
																		height: c,
																		resampleMethod: s,
																		signal: h
																	}),
																	(m = this.fileDirectory),
																	(t.next = 23),
																	this.readRasters(w)
																);
															case 23:
																((b = t.sent),
																	(x = Math.pow(
																		2,
																		this.fileDirectory
																			.BitsPerSample[0]
																	)),
																	(t.t1 = y),
																	(t.next =
																		t.t1 === Dt.Ie.WhiteIsZero
																			? 28
																			: t.t1 ===
																				  Dt.Ie.BlackIsZero
																				? 30
																				: t.t1 ===
																					  Dt.Ie.Palette
																					? 32
																					: t.t1 ===
																						  Dt.Ie.CMYK
																						? 34
																						: t.t1 ===
																							  Dt.Ie
																									.YCbCr
																							? 36
																							: t.t1 ===
																								  Dt
																										.Ie
																										.CIELab
																								? 38
																								: 40));
																break;
															case 28:
																return (
																	(k = jt(b, x)),
																	t.abrupt('break', 41)
																);
															case 30:
																return (
																	(k = Mt(b, x)),
																	t.abrupt('break', 41)
																);
															case 32:
																return (
																	(k = Ft(b, m.ColorMap)),
																	t.abrupt('break', 41)
																);
															case 34:
																return (
																	(k = Nt(b)),
																	t.abrupt('break', 41)
																);
															case 36:
																return (
																	(k = Ut(b)),
																	t.abrupt('break', 41)
																);
															case 38:
																return (
																	(k = Ct(b)),
																	t.abrupt('break', 41)
																);
															case 40:
																throw new Error(
																	'Unsupported photometric interpretation.'
																);
															case 41:
																if (!i) {
																	for (
																		E = new Uint8Array(
																			k.length / 3
																		),
																			S = new Uint8Array(
																				k.length / 3
																			),
																			L = new Uint8Array(
																				k.length / 3
																			),
																			g = 0,
																			O = 0;
																		g < k.length;
																		g += 3, ++O
																	)
																		((E[O] = k[g]),
																			(S[O] = k[g + 1]),
																			(L[O] = k[g + 2]));
																	k = [E, S, L];
																}
																return (
																	(k.width = b.width),
																	(k.height = b.height),
																	t.abrupt('return', k)
																);
															case 45:
															case 'end':
																return t.stop();
														}
												},
												t,
												this
											);
										})
									);
									return function () {
										return t.apply(this, arguments);
									};
								})()
							},
							{
								key: 'getTiePoints',
								value: function () {
									if (!this.fileDirectory.ModelTiepoint) return [];
									for (
										var t = [], e = 0;
										e < this.fileDirectory.ModelTiepoint.length;
										e += 6
									)
										t.push({
											i: this.fileDirectory.ModelTiepoint[e],
											j: this.fileDirectory.ModelTiepoint[e + 1],
											k: this.fileDirectory.ModelTiepoint[e + 2],
											x: this.fileDirectory.ModelTiepoint[e + 3],
											y: this.fileDirectory.ModelTiepoint[e + 4],
											z: this.fileDirectory.ModelTiepoint[e + 5]
										});
									return t;
								}
							},
							{
								key: 'getGDALMetadata',
								value: function () {
									var t =
											arguments.length > 0 && void 0 !== arguments[0]
												? arguments[0]
												: null,
										e = {};
									if (!this.fileDirectory.GDAL_METADATA) return null;
									var r = this.fileDirectory.GDAL_METADATA,
										n = Gt(r, 'Item');
									n =
										null === t
											? n.filter(function (t) {
													return void 0 === At(t, 'sample');
												})
											: n.filter(function (e) {
													return Number(At(e, 'sample')) === t;
												});
									for (var i = 0; i < n.length; ++i) {
										var o = n[i];
										e[At(o, 'name')] = o.inner;
									}
									return e;
								}
							},
							{
								key: 'getGDALNoData',
								value: function () {
									if (!this.fileDirectory.GDAL_NODATA) return null;
									var t = this.fileDirectory.GDAL_NODATA;
									return Number(t.substring(0, t.length - 1));
								}
							},
							{
								key: 'getOrigin',
								value: function () {
									var t = this.fileDirectory.ModelTiepoint,
										e = this.fileDirectory.ModelTransformation;
									if (t && 6 === t.length) return [t[3], t[4], t[5]];
									if (e) return [e[3], e[7], e[11]];
									throw new Error(
										'The image does not have an affine transformation.'
									);
								}
							},
							{
								key: 'getResolution',
								value: function () {
									var t =
											arguments.length > 0 && void 0 !== arguments[0]
												? arguments[0]
												: null,
										e = this.fileDirectory.ModelPixelScale,
										r = this.fileDirectory.ModelTransformation;
									if (e) return [e[0], -e[1], e[2]];
									if (r) return [r[0], r[5], r[10]];
									if (t) {
										var n = t.getResolution(),
											i = c(n, 3),
											o = i[0],
											a = i[1],
											u = i[2];
										return [
											(o * t.getWidth()) / this.getWidth(),
											(a * t.getHeight()) / this.getHeight(),
											(u * t.getWidth()) / this.getWidth()
										];
									}
									throw new Error(
										'The image does not have an affine transformation.'
									);
								}
							},
							{
								key: 'pixelIsArea',
								value: function () {
									return 1 === this.geoKeys.GTRasterTypeGeoKey;
								}
							},
							{
								key: 'getBoundingBox',
								value: function () {
									var t = this.getOrigin(),
										e = this.getResolution(),
										r = t[0],
										n = t[1],
										i = r + e[0] * this.getWidth(),
										o = n + e[1] * this.getHeight();
									return [
										Math.min(r, i),
										Math.min(n, o),
										Math.max(r, i),
										Math.max(n, o)
									];
								}
							}
						]),
						t
					);
				})(),
				oe = ie,
				ae = (function () {
					function t(e) {
						((0, w.Z)(this, t), (this._dataView = new DataView(e)));
					}
					return (
						(0, v.Z)(t, [
							{
								key: 'buffer',
								get: function () {
									return this._dataView.buffer;
								}
							},
							{
								key: 'getUint64',
								value: function (t, e) {
									var r,
										n = this.getUint32(t, e),
										i = this.getUint32(t + 4, e);
									if (e) {
										if (
											((r = n + Math.pow(2, 32) * i),
											!Number.isSafeInteger(r))
										)
											throw new Error(
												''.concat(r, ' exceeds MAX_SAFE_INTEGER. ') +
													'Precision may be lost. Please report if you get this message to https://github.com/geotiffjs/geotiff.js/issues'
											);
										return r;
									}
									if (((r = Math.pow(2, 32) * n + i), !Number.isSafeInteger(r)))
										throw new Error(
											''.concat(r, ' exceeds MAX_SAFE_INTEGER. ') +
												'Precision may be lost. Please report if you get this message to https://github.com/geotiffjs/geotiff.js/issues'
										);
									return r;
								}
							},
							{
								key: 'getInt64',
								value: function (t, e) {
									for (
										var r = 0,
											n =
												(128 & this._dataView.getUint8(t + (e ? 7 : 0))) >
												0,
											i = !0,
											o = 0;
										o < 8;
										o++
									) {
										var a = this._dataView.getUint8(t + (e ? o : 7 - o));
										(n &&
											(i
												? 0 !== a && ((a = 255 & ~(a - 1)), (i = !1))
												: (a = 255 & ~a)),
											(r += a * Math.pow(256, o)));
									}
									return (n && (r = -r), r);
								}
							},
							{
								key: 'getUint8',
								value: function (t, e) {
									return this._dataView.getUint8(t, e);
								}
							},
							{
								key: 'getInt8',
								value: function (t, e) {
									return this._dataView.getInt8(t, e);
								}
							},
							{
								key: 'getUint16',
								value: function (t, e) {
									return this._dataView.getUint16(t, e);
								}
							},
							{
								key: 'getInt16',
								value: function (t, e) {
									return this._dataView.getInt16(t, e);
								}
							},
							{
								key: 'getUint32',
								value: function (t, e) {
									return this._dataView.getUint32(t, e);
								}
							},
							{
								key: 'getInt32',
								value: function (t, e) {
									return this._dataView.getInt32(t, e);
								}
							},
							{
								key: 'getFloat16',
								value: function (t, e) {
									return _t(this._dataView, t, e);
								}
							},
							{
								key: 'getFloat32',
								value: function (t, e) {
									return this._dataView.getFloat32(t, e);
								}
							},
							{
								key: 'getFloat64',
								value: function (t, e) {
									return this._dataView.getFloat64(t, e);
								}
							}
						]),
						t
					);
				})(),
				ue = (function () {
					function t(e, r, n, i) {
						((0, w.Z)(this, t),
							(this._dataView = new DataView(e)),
							(this._sliceOffset = r),
							(this._littleEndian = n),
							(this._bigTiff = i));
					}
					return (
						(0, v.Z)(t, [
							{
								key: 'sliceOffset',
								get: function () {
									return this._sliceOffset;
								}
							},
							{
								key: 'sliceTop',
								get: function () {
									return this._sliceOffset + this.buffer.byteLength;
								}
							},
							{
								key: 'littleEndian',
								get: function () {
									return this._littleEndian;
								}
							},
							{
								key: 'bigTiff',
								get: function () {
									return this._bigTiff;
								}
							},
							{
								key: 'buffer',
								get: function () {
									return this._dataView.buffer;
								}
							},
							{
								key: 'covers',
								value: function (t, e) {
									return this.sliceOffset <= t && this.sliceTop >= t + e;
								}
							},
							{
								key: 'readUint8',
								value: function (t) {
									return this._dataView.getUint8(
										t - this._sliceOffset,
										this._littleEndian
									);
								}
							},
							{
								key: 'readInt8',
								value: function (t) {
									return this._dataView.getInt8(
										t - this._sliceOffset,
										this._littleEndian
									);
								}
							},
							{
								key: 'readUint16',
								value: function (t) {
									return this._dataView.getUint16(
										t - this._sliceOffset,
										this._littleEndian
									);
								}
							},
							{
								key: 'readInt16',
								value: function (t) {
									return this._dataView.getInt16(
										t - this._sliceOffset,
										this._littleEndian
									);
								}
							},
							{
								key: 'readUint32',
								value: function (t) {
									return this._dataView.getUint32(
										t - this._sliceOffset,
										this._littleEndian
									);
								}
							},
							{
								key: 'readInt32',
								value: function (t) {
									return this._dataView.getInt32(
										t - this._sliceOffset,
										this._littleEndian
									);
								}
							},
							{
								key: 'readFloat32',
								value: function (t) {
									return this._dataView.getFloat32(
										t - this._sliceOffset,
										this._littleEndian
									);
								}
							},
							{
								key: 'readFloat64',
								value: function (t) {
									return this._dataView.getFloat64(
										t - this._sliceOffset,
										this._littleEndian
									);
								}
							},
							{
								key: 'readUint64',
								value: function (t) {
									var e,
										r = this.readUint32(t),
										n = this.readUint32(t + 4);
									if (this._littleEndian) {
										if (
											((e = r + Math.pow(2, 32) * n),
											!Number.isSafeInteger(e))
										)
											throw new Error(
												''.concat(e, ' exceeds MAX_SAFE_INTEGER. ') +
													'Precision may be lost. Please report if you get this message to https://github.com/geotiffjs/geotiff.js/issues'
											);
										return e;
									}
									if (((e = Math.pow(2, 32) * r + n), !Number.isSafeInteger(e)))
										throw new Error(
											''.concat(e, ' exceeds MAX_SAFE_INTEGER. ') +
												'Precision may be lost. Please report if you get this message to https://github.com/geotiffjs/geotiff.js/issues'
										);
									return e;
								}
							},
							{
								key: 'readInt64',
								value: function (t) {
									for (
										var e = 0,
											r =
												(128 &
													this._dataView.getUint8(
														t + (this._littleEndian ? 7 : 0)
													)) >
												0,
											n = !0,
											i = 0;
										i < 8;
										i++
									) {
										var o = this._dataView.getUint8(
											t + (this._littleEndian ? i : 7 - i)
										);
										(r &&
											(n
												? 0 !== o && ((o = 255 & ~(o - 1)), (n = !1))
												: (o = 255 & ~o)),
											(e += o * Math.pow(256, i)));
									}
									return (r && (e = -e), e);
								}
							},
							{
								key: 'readOffset',
								value: function (t) {
									return this._bigTiff ? this.readUint64(t) : this.readUint32(t);
								}
							}
						]),
						t
					);
				})();
			function ce() {
				ce = function () {
					return t;
				};
				var t = {},
					e = Object.prototype,
					r = e.hasOwnProperty,
					n = 'function' == typeof Symbol ? Symbol : {},
					i = n.iterator || '@@iterator',
					o = n.asyncIterator || '@@asyncIterator',
					a = n.toStringTag || '@@toStringTag';
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
				} catch (Se) {
					u = function (t, e, r) {
						return (t[e] = r);
					};
				}
				function c(t, e, r, n) {
					var i = e && e.prototype instanceof l ? e : l,
						o = Object.create(i.prototype),
						a = new E(n || []);
					return (
						(o._invoke = (function (t, e, r) {
							var n = 'suspendedStart';
							return function (i, o) {
								if ('executing' === n)
									throw new Error('Generator is already running');
								if ('completed' === n) {
									if ('throw' === i) throw o;
									return L();
								}
								for (r.method = i, r.arg = o; ; ) {
									var a = r.delegate;
									if (a) {
										var u = b(a, r);
										if (u) {
											if (u === f) continue;
											return u;
										}
									}
									if ('next' === r.method) r.sent = r._sent = r.arg;
									else if ('throw' === r.method) {
										if ('suspendedStart' === n)
											throw ((n = 'completed'), r.arg);
										r.dispatchException(r.arg);
									} else 'return' === r.method && r.abrupt('return', r.arg);
									n = 'executing';
									var c = s(t, e, r);
									if ('normal' === c.type) {
										if (
											((n = r.done ? 'completed' : 'suspendedYield'),
											c.arg === f)
										)
											continue;
										return { value: c.arg, done: r.done };
									}
									'throw' === c.type &&
										((n = 'completed'), (r.method = 'throw'), (r.arg = c.arg));
								}
							};
						})(t, r, a)),
						o
					);
				}
				function s(t, e, r) {
					try {
						return { type: 'normal', arg: t.call(e, r) };
					} catch (Se) {
						return { type: 'throw', arg: Se };
					}
				}
				t.wrap = c;
				var f = {};
				function l() {}
				function h() {}
				function p() {}
				var y = {};
				u(y, i, function () {
					return this;
				});
				var d = Object.getPrototypeOf,
					g = d && d(d(S([])));
				g && g !== e && r.call(g, i) && (y = g);
				var v = (p.prototype = l.prototype = Object.create(y));
				function w(t) {
					['next', 'throw', 'return'].forEach(function (e) {
						u(t, e, function (t) {
							return this._invoke(e, t);
						});
					});
				}
				function m(t, e) {
					function n(i, o, a, u) {
						var c = s(t[i], t, o);
						if ('throw' !== c.type) {
							var f = c.arg,
								l = f.value;
							return l && 'object' == typeof l && r.call(l, '__await')
								? e.resolve(l.__await).then(
										function (t) {
											n('next', t, a, u);
										},
										function (t) {
											n('throw', t, a, u);
										}
									)
								: e.resolve(l).then(
										function (t) {
											((f.value = t), a(f));
										},
										function (t) {
											return n('throw', t, a, u);
										}
									);
						}
						u(c.arg);
					}
					var i;
					this._invoke = function (t, r) {
						function o() {
							return new e(function (e, i) {
								n(t, r, e, i);
							});
						}
						return (i = i ? i.then(o, o) : o());
					};
				}
				function b(t, e) {
					var r = t.iterator[e.method];
					if (void 0 === r) {
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
					var n = s(r, t.iterator, e.arg);
					if ('throw' === n.type)
						return ((e.method = 'throw'), (e.arg = n.arg), (e.delegate = null), f);
					var i = n.arg;
					return i
						? i.done
							? ((e[t.resultName] = i.value),
								(e.next = t.nextLoc),
								'return' !== e.method && ((e.method = 'next'), (e.arg = void 0)),
								(e.delegate = null),
								f)
							: i
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
				function k(t) {
					var e = t.completion || {};
					((e.type = 'normal'), delete e.arg, (t.completion = e));
				}
				function E(t) {
					((this.tryEntries = [{ tryLoc: 'root' }]), t.forEach(x, this), this.reset(!0));
				}
				function S(t) {
					if (t) {
						var e = t[i];
						if (e) return e.call(t);
						if ('function' == typeof t.next) return t;
						if (!isNaN(t.length)) {
							var n = -1,
								o = function e() {
									for (; ++n < t.length; )
										if (r.call(t, n))
											return ((e.value = t[n]), (e.done = !1), e);
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
					(h.prototype = p),
					u(v, 'constructor', p),
					u(p, 'constructor', h),
					(h.displayName = u(p, a, 'GeneratorFunction')),
					(t.isGeneratorFunction = function (t) {
						var e = 'function' == typeof t && t.constructor;
						return (
							!!e && (e === h || 'GeneratorFunction' === (e.displayName || e.name))
						);
					}),
					(t.mark = function (t) {
						return (
							Object.setPrototypeOf
								? Object.setPrototypeOf(t, p)
								: ((t.__proto__ = p), u(t, a, 'GeneratorFunction')),
							(t.prototype = Object.create(v)),
							t
						);
					}),
					(t.awrap = function (t) {
						return { __await: t };
					}),
					w(m.prototype),
					u(m.prototype, o, function () {
						return this;
					}),
					(t.AsyncIterator = m),
					(t.async = function (e, r, n, i, o) {
						void 0 === o && (o = Promise);
						var a = new m(c(e, r, n, i), o);
						return t.isGeneratorFunction(r)
							? a
							: a.next().then(function (t) {
									return t.done ? t.value : a.next();
								});
					}),
					w(v),
					u(v, a, 'Generator'),
					u(v, i, function () {
						return this;
					}),
					u(v, 'toString', function () {
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
					(t.values = S),
					(E.prototype = {
						constructor: E,
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
							for (var i = this.tryEntries.length - 1; i >= 0; --i) {
								var o = this.tryEntries[i],
									a = o.completion;
								if ('root' === o.tryLoc) return n('end');
								if (o.tryLoc <= this.prev) {
									var u = r.call(o, 'catchLoc'),
										c = r.call(o, 'finallyLoc');
									if (u && c) {
										if (this.prev < o.catchLoc) return n(o.catchLoc, !0);
										if (this.prev < o.finallyLoc) return n(o.finallyLoc);
									} else if (u) {
										if (this.prev < o.catchLoc) return n(o.catchLoc, !0);
									} else {
										if (!c)
											throw new Error(
												'try statement without catch or finally'
											);
										if (this.prev < o.finallyLoc) return n(o.finallyLoc);
									}
								}
							}
						},
						abrupt: function (t, e) {
							for (var n = this.tryEntries.length - 1; n >= 0; --n) {
								var i = this.tryEntries[n];
								if (
									i.tryLoc <= this.prev &&
									r.call(i, 'finallyLoc') &&
									this.prev < i.finallyLoc
								) {
									var o = i;
									break;
								}
							}
							o &&
								('break' === t || 'continue' === t) &&
								o.tryLoc <= e &&
								e <= o.finallyLoc &&
								(o = null);
							var a = o ? o.completion : {};
							return (
								(a.type = t),
								(a.arg = e),
								o
									? ((this.method = 'next'), (this.next = o.finallyLoc), f)
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
								var r = this.tryEntries[e];
								if (r.finallyLoc === t)
									return (this.complete(r.completion, r.afterLoc), k(r), f);
							}
						},
						catch: function (t) {
							for (var e = this.tryEntries.length - 1; e >= 0; --e) {
								var r = this.tryEntries[e];
								if (r.tryLoc === t) {
									var n = r.completion;
									if ('throw' === n.type) {
										var i = n.arg;
										k(r);
									}
									return i;
								}
							}
							throw new Error('illegal catch attempt');
						},
						delegateYield: function (t, e, r) {
							return (
								(this.delegate = { iterator: S(t), resultName: e, nextLoc: r }),
								'next' === this.method && (this.arg = void 0),
								f
							);
						}
					}),
					t
				);
			}
			var se = (function () {
					function t() {
						(0, w.Z)(this, t);
					}
					return (
						(0, v.Z)(t, [
							{
								key: 'fetch',
								value: (function () {
									var t = (0, s.Z)(
										ce().mark(function t(e) {
											var r,
												n = this,
												i = arguments;
											return ce().wrap(function (t) {
												for (;;)
													switch ((t.prev = t.next)) {
														case 0:
															return (
																(r =
																	i.length > 1 && void 0 !== i[1]
																		? i[1]
																		: void 0),
																t.abrupt(
																	'return',
																	Promise.all(
																		e.map(function (t) {
																			return n.fetchSlice(
																				t,
																				r
																			);
																		})
																	)
																)
															);
														case 2:
														case 'end':
															return t.stop();
													}
											}, t);
										})
									);
									return function (e) {
										return t.apply(this, arguments);
									};
								})()
							},
							{
								key: 'fetchSlice',
								value: (function () {
									var t = (0, s.Z)(
										ce().mark(function t(e) {
											return ce().wrap(function (t) {
												for (;;)
													switch ((t.prev = t.next)) {
														case 0:
															throw new Error(
																'fetching of slice '.concat(
																	e,
																	' not possible, not implemented'
																)
															);
														case 1:
														case 'end':
															return t.stop();
													}
											}, t);
										})
									);
									return function (e) {
										return t.apply(this, arguments);
									};
								})()
							},
							{
								key: 'fileSize',
								get: function () {
									return null;
								}
							},
							{
								key: 'close',
								value: (function () {
									var t = (0, s.Z)(
										ce().mark(function t() {
											return ce().wrap(function (t) {
												for (;;)
													switch ((t.prev = t.next)) {
														case 0:
														case 'end':
															return t.stop();
													}
											}, t);
										})
									);
									return function () {
										return t.apply(this, arguments);
									};
								})()
							}
						]),
						t
					);
				})(),
				fe = r(753);
			var le = (function (t) {
					(0, f.Z)(r, t);
					var e = (0, l.Z)(r);
					function r(t) {
						var n;
						return (
							(0, w.Z)(this, r),
							(n = e.call(this, t)),
							Error.captureStackTrace && Error.captureStackTrace((0, fe.Z)(n), r),
							(n.name = 'AbortError'),
							n
						);
					}
					return (0, v.Z)(r);
				})(g(Error)),
				he =
					(Error,
					(function (t) {
						(0, f.Z)(r, t);
						var e = (0, l.Z)(r);
						function r(t) {
							var n;
							return ((0, w.Z)(this, r), ((n = e.call(this)).arrayBuffer = t), n);
						}
						return (
							(0, v.Z)(r, [
								{
									key: 'fetchSlice',
									value: function (t, e) {
										if (e && e.aborted) throw new le('Request aborted');
										return this.arrayBuffer.slice(
											t.offset,
											t.offset + t.length
										);
									}
								}
							]),
							r
						);
					})(se));
			function pe(t) {
				return new he(t);
			}
			function ye() {
				ye = function () {
					return t;
				};
				var t = {},
					e = Object.prototype,
					r = e.hasOwnProperty,
					n = 'function' == typeof Symbol ? Symbol : {},
					i = n.iterator || '@@iterator',
					o = n.asyncIterator || '@@asyncIterator',
					a = n.toStringTag || '@@toStringTag';
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
				} catch (Se) {
					u = function (t, e, r) {
						return (t[e] = r);
					};
				}
				function c(t, e, r, n) {
					var i = e && e.prototype instanceof l ? e : l,
						o = Object.create(i.prototype),
						a = new E(n || []);
					return (
						(o._invoke = (function (t, e, r) {
							var n = 'suspendedStart';
							return function (i, o) {
								if ('executing' === n)
									throw new Error('Generator is already running');
								if ('completed' === n) {
									if ('throw' === i) throw o;
									return L();
								}
								for (r.method = i, r.arg = o; ; ) {
									var a = r.delegate;
									if (a) {
										var u = b(a, r);
										if (u) {
											if (u === f) continue;
											return u;
										}
									}
									if ('next' === r.method) r.sent = r._sent = r.arg;
									else if ('throw' === r.method) {
										if ('suspendedStart' === n)
											throw ((n = 'completed'), r.arg);
										r.dispatchException(r.arg);
									} else 'return' === r.method && r.abrupt('return', r.arg);
									n = 'executing';
									var c = s(t, e, r);
									if ('normal' === c.type) {
										if (
											((n = r.done ? 'completed' : 'suspendedYield'),
											c.arg === f)
										)
											continue;
										return { value: c.arg, done: r.done };
									}
									'throw' === c.type &&
										((n = 'completed'), (r.method = 'throw'), (r.arg = c.arg));
								}
							};
						})(t, r, a)),
						o
					);
				}
				function s(t, e, r) {
					try {
						return { type: 'normal', arg: t.call(e, r) };
					} catch (Se) {
						return { type: 'throw', arg: Se };
					}
				}
				t.wrap = c;
				var f = {};
				function l() {}
				function h() {}
				function p() {}
				var y = {};
				u(y, i, function () {
					return this;
				});
				var d = Object.getPrototypeOf,
					g = d && d(d(S([])));
				g && g !== e && r.call(g, i) && (y = g);
				var v = (p.prototype = l.prototype = Object.create(y));
				function w(t) {
					['next', 'throw', 'return'].forEach(function (e) {
						u(t, e, function (t) {
							return this._invoke(e, t);
						});
					});
				}
				function m(t, e) {
					function n(i, o, a, u) {
						var c = s(t[i], t, o);
						if ('throw' !== c.type) {
							var f = c.arg,
								l = f.value;
							return l && 'object' == typeof l && r.call(l, '__await')
								? e.resolve(l.__await).then(
										function (t) {
											n('next', t, a, u);
										},
										function (t) {
											n('throw', t, a, u);
										}
									)
								: e.resolve(l).then(
										function (t) {
											((f.value = t), a(f));
										},
										function (t) {
											return n('throw', t, a, u);
										}
									);
						}
						u(c.arg);
					}
					var i;
					this._invoke = function (t, r) {
						function o() {
							return new e(function (e, i) {
								n(t, r, e, i);
							});
						}
						return (i = i ? i.then(o, o) : o());
					};
				}
				function b(t, e) {
					var r = t.iterator[e.method];
					if (void 0 === r) {
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
					var n = s(r, t.iterator, e.arg);
					if ('throw' === n.type)
						return ((e.method = 'throw'), (e.arg = n.arg), (e.delegate = null), f);
					var i = n.arg;
					return i
						? i.done
							? ((e[t.resultName] = i.value),
								(e.next = t.nextLoc),
								'return' !== e.method && ((e.method = 'next'), (e.arg = void 0)),
								(e.delegate = null),
								f)
							: i
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
				function k(t) {
					var e = t.completion || {};
					((e.type = 'normal'), delete e.arg, (t.completion = e));
				}
				function E(t) {
					((this.tryEntries = [{ tryLoc: 'root' }]), t.forEach(x, this), this.reset(!0));
				}
				function S(t) {
					if (t) {
						var e = t[i];
						if (e) return e.call(t);
						if ('function' == typeof t.next) return t;
						if (!isNaN(t.length)) {
							var n = -1,
								o = function e() {
									for (; ++n < t.length; )
										if (r.call(t, n))
											return ((e.value = t[n]), (e.done = !1), e);
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
					(h.prototype = p),
					u(v, 'constructor', p),
					u(p, 'constructor', h),
					(h.displayName = u(p, a, 'GeneratorFunction')),
					(t.isGeneratorFunction = function (t) {
						var e = 'function' == typeof t && t.constructor;
						return (
							!!e && (e === h || 'GeneratorFunction' === (e.displayName || e.name))
						);
					}),
					(t.mark = function (t) {
						return (
							Object.setPrototypeOf
								? Object.setPrototypeOf(t, p)
								: ((t.__proto__ = p), u(t, a, 'GeneratorFunction')),
							(t.prototype = Object.create(v)),
							t
						);
					}),
					(t.awrap = function (t) {
						return { __await: t };
					}),
					w(m.prototype),
					u(m.prototype, o, function () {
						return this;
					}),
					(t.AsyncIterator = m),
					(t.async = function (e, r, n, i, o) {
						void 0 === o && (o = Promise);
						var a = new m(c(e, r, n, i), o);
						return t.isGeneratorFunction(r)
							? a
							: a.next().then(function (t) {
									return t.done ? t.value : a.next();
								});
					}),
					w(v),
					u(v, a, 'Generator'),
					u(v, i, function () {
						return this;
					}),
					u(v, 'toString', function () {
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
					(t.values = S),
					(E.prototype = {
						constructor: E,
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
							for (var i = this.tryEntries.length - 1; i >= 0; --i) {
								var o = this.tryEntries[i],
									a = o.completion;
								if ('root' === o.tryLoc) return n('end');
								if (o.tryLoc <= this.prev) {
									var u = r.call(o, 'catchLoc'),
										c = r.call(o, 'finallyLoc');
									if (u && c) {
										if (this.prev < o.catchLoc) return n(o.catchLoc, !0);
										if (this.prev < o.finallyLoc) return n(o.finallyLoc);
									} else if (u) {
										if (this.prev < o.catchLoc) return n(o.catchLoc, !0);
									} else {
										if (!c)
											throw new Error(
												'try statement without catch or finally'
											);
										if (this.prev < o.finallyLoc) return n(o.finallyLoc);
									}
								}
							}
						},
						abrupt: function (t, e) {
							for (var n = this.tryEntries.length - 1; n >= 0; --n) {
								var i = this.tryEntries[n];
								if (
									i.tryLoc <= this.prev &&
									r.call(i, 'finallyLoc') &&
									this.prev < i.finallyLoc
								) {
									var o = i;
									break;
								}
							}
							o &&
								('break' === t || 'continue' === t) &&
								o.tryLoc <= e &&
								e <= o.finallyLoc &&
								(o = null);
							var a = o ? o.completion : {};
							return (
								(a.type = t),
								(a.arg = e),
								o
									? ((this.method = 'next'), (this.next = o.finallyLoc), f)
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
								var r = this.tryEntries[e];
								if (r.finallyLoc === t)
									return (this.complete(r.completion, r.afterLoc), k(r), f);
							}
						},
						catch: function (t) {
							for (var e = this.tryEntries.length - 1; e >= 0; --e) {
								var r = this.tryEntries[e];
								if (r.tryLoc === t) {
									var n = r.completion;
									if ('throw' === n.type) {
										var i = n.arg;
										k(r);
									}
									return i;
								}
							}
							throw new Error('illegal catch attempt');
						},
						delegateYield: function (t, e, r) {
							return (
								(this.delegate = { iterator: S(t), resultName: e, nextLoc: r }),
								'next' === this.method && (this.arg = void 0),
								f
							);
						}
					}),
					t
				);
			}
			function de(t) {
				switch (t) {
					case Dt.sf.BYTE:
					case Dt.sf.ASCII:
					case Dt.sf.SBYTE:
					case Dt.sf.UNDEFINED:
						return 1;
					case Dt.sf.SHORT:
					case Dt.sf.SSHORT:
						return 2;
					case Dt.sf.LONG:
					case Dt.sf.SLONG:
					case Dt.sf.FLOAT:
					case Dt.sf.IFD:
						return 4;
					case Dt.sf.RATIONAL:
					case Dt.sf.SRATIONAL:
					case Dt.sf.DOUBLE:
					case Dt.sf.LONG8:
					case Dt.sf.SLONG8:
					case Dt.sf.IFD8:
						return 8;
					default:
						throw new RangeError('Invalid field type: '.concat(t));
				}
			}
			function ge(t) {
				var e = t.GeoKeyDirectory;
				if (!e) return null;
				for (var r = {}, n = 4; n <= 4 * e[3]; n += 4) {
					var i = Dt.P1[e[n]],
						o = e[n + 1] ? Dt.L[e[n + 1]] : null,
						a = e[n + 2],
						u = e[n + 3],
						c = null;
					if (o) {
						if ('undefined' === typeof (c = t[o]) || null === c)
							throw new Error("Could not get value of geoKey '".concat(i, "'."));
						'string' === typeof c
							? (c = c.substring(u, u + a - 1))
							: c.subarray && ((c = c.subarray(u, u + a)), 1 === a && (c = c[0]));
					} else c = u;
					r[i] = c;
				}
				return r;
			}
			function ve(t, e, r, n) {
				var i = null,
					o = null,
					a = de(e);
				switch (e) {
					case Dt.sf.BYTE:
					case Dt.sf.ASCII:
					case Dt.sf.UNDEFINED:
						((i = new Uint8Array(r)), (o = t.readUint8));
						break;
					case Dt.sf.SBYTE:
						((i = new Int8Array(r)), (o = t.readInt8));
						break;
					case Dt.sf.SHORT:
						((i = new Uint16Array(r)), (o = t.readUint16));
						break;
					case Dt.sf.SSHORT:
						((i = new Int16Array(r)), (o = t.readInt16));
						break;
					case Dt.sf.LONG:
					case Dt.sf.IFD:
						((i = new Uint32Array(r)), (o = t.readUint32));
						break;
					case Dt.sf.SLONG:
						((i = new Int32Array(r)), (o = t.readInt32));
						break;
					case Dt.sf.LONG8:
					case Dt.sf.IFD8:
						((i = new Array(r)), (o = t.readUint64));
						break;
					case Dt.sf.SLONG8:
						((i = new Array(r)), (o = t.readInt64));
						break;
					case Dt.sf.RATIONAL:
						((i = new Uint32Array(2 * r)), (o = t.readUint32));
						break;
					case Dt.sf.SRATIONAL:
						((i = new Int32Array(2 * r)), (o = t.readInt32));
						break;
					case Dt.sf.FLOAT:
						((i = new Float32Array(r)), (o = t.readFloat32));
						break;
					case Dt.sf.DOUBLE:
						((i = new Float64Array(r)), (o = t.readFloat64));
						break;
					default:
						throw new RangeError('Invalid field type: '.concat(e));
				}
				if (e !== Dt.sf.RATIONAL && e !== Dt.sf.SRATIONAL)
					for (var u = 0; u < r; ++u) i[u] = o.call(t, n + u * a);
				else
					for (var c = 0; c < r; c += 2)
						((i[c] = o.call(t, n + c * a)), (i[c + 1] = o.call(t, n + (c * a + 4))));
				return e === Dt.sf.ASCII ? new TextDecoder('utf-8').decode(i) : i;
			}
			var we = (0, v.Z)(function t(e, r, n) {
					((0, w.Z)(this, t),
						(this.fileDirectory = e),
						(this.geoKeyDirectory = r),
						(this.nextIFDByteOffset = n));
				}),
				me = (function (t) {
					(0, f.Z)(r, t);
					var e = (0, l.Z)(r);
					function r(t) {
						var n;
						return (
							(0, w.Z)(this, r),
							((n = e.call(this, 'No image at index '.concat(t))).index = t),
							n
						);
					}
					return (0, v.Z)(r);
				})(g(Error)),
				be = (function () {
					function t() {
						(0, w.Z)(this, t);
					}
					return (
						(0, v.Z)(t, [
							{
								key: 'readRasters',
								value: (function () {
									var t = (0, s.Z)(
										ye().mark(function t() {
											var e,
												r,
												n,
												i,
												a,
												u,
												s,
												f,
												l,
												h,
												p,
												y,
												d,
												g,
												v,
												w,
												m,
												b,
												x,
												k,
												E,
												S,
												L,
												O,
												T,
												P,
												I,
												_,
												A,
												G,
												D,
												j,
												M,
												F,
												N,
												U,
												C,
												R,
												Z,
												B = arguments;
											return ye().wrap(
												function (t) {
													for (;;)
														switch ((t.prev = t.next)) {
															case 0:
																return (
																	(e =
																		B.length > 0 &&
																		void 0 !== B[0]
																			? B[0]
																			: {}),
																	(r = e.window),
																	(n = e.width),
																	(i = e.height),
																	(a = e.resX),
																	(u = e.resY),
																	(s = e.bbox),
																	(t.next = 5),
																	this.getImage()
																);
															case 5:
																return (
																	(f = t.sent),
																	(l = f),
																	(t.next = 9),
																	this.getImageCount()
																);
															case 9:
																if (
																	((h = t.sent),
																	(p = f.getBoundingBox()),
																	!r || !s)
																) {
																	t.next = 13;
																	break;
																}
																throw new Error(
																	'Both "bbox" and "window" passed.'
																);
															case 13:
																if (!n && !i) {
																	t.next = 24;
																	break;
																}
																if (
																	(r &&
																		((y = f.getOrigin()),
																		(d = c(y, 2)),
																		(g = d[0]),
																		(v = d[1]),
																		(w = f.getResolution()),
																		(m = c(w, 2)),
																		(b = m[0]),
																		(x = m[1]),
																		(s = [
																			g + r[0] * b,
																			v + r[1] * x,
																			g + r[2] * b,
																			v + r[3] * x
																		])),
																	(k = s || p),
																	!n)
																) {
																	t.next = 20;
																	break;
																}
																if (!a) {
																	t.next = 19;
																	break;
																}
																throw new Error(
																	'Both width and resX passed'
																);
															case 19:
																a = (k[2] - k[0]) / n;
															case 20:
																if (!i) {
																	t.next = 24;
																	break;
																}
																if (!u) {
																	t.next = 23;
																	break;
																}
																throw new Error(
																	'Both width and resY passed'
																);
															case 23:
																u = (k[3] - k[1]) / i;
															case 24:
																if (!a && !u) {
																	t.next = 48;
																	break;
																}
																((E = []), (S = 0));
															case 27:
																if (!(S < h)) {
																	t.next = 36;
																	break;
																}
																return (
																	(t.next = 30),
																	this.getImage(S)
																);
															case 30:
																((L = t.sent),
																	(O = L.fileDirectory),
																	(T = O.SubfileType),
																	(P = O.NewSubfileType),
																	(0 === S || 2 === T || 1 & P) &&
																		E.push(L));
															case 33:
																(++S, (t.next = 27));
																break;
															case 36:
																(E.sort(function (t, e) {
																	return (
																		t.getWidth() - e.getWidth()
																	);
																}),
																	(I = 0));
															case 38:
																if (!(I < E.length)) {
																	t.next = 48;
																	break;
																}
																if (
																	((_ = E[I]),
																	(A =
																		(p[2] - p[0]) /
																		_.getWidth()),
																	(G =
																		(p[3] - p[1]) /
																		_.getHeight()),
																	(l = _),
																	!((a && a > A) || (u && u > G)))
																) {
																	t.next = 45;
																	break;
																}
																return t.abrupt('break', 48);
															case 45:
																(++I, (t.next = 38));
																break;
															case 48:
																return (
																	(D = r),
																	s &&
																		((j = f.getOrigin()),
																		(M = c(j, 2)),
																		(F = M[0]),
																		(N = M[1]),
																		(U = l.getResolution(f)),
																		(C = c(U, 2)),
																		(R = C[0]),
																		(Z = C[1]),
																		(D = [
																			Math.round(
																				(s[0] - F) / R
																			),
																			Math.round(
																				(s[1] - N) / Z
																			),
																			Math.round(
																				(s[2] - F) / R
																			),
																			Math.round(
																				(s[3] - N) / Z
																			)
																		]),
																		(D = [
																			Math.min(D[0], D[2]),
																			Math.min(D[1], D[3]),
																			Math.max(D[0], D[2]),
																			Math.max(D[1], D[3])
																		])),
																	t.abrupt(
																		'return',
																		l.readRasters(
																			o(
																				o({}, e),
																				{},
																				{ window: D }
																			)
																		)
																	)
																);
															case 51:
															case 'end':
																return t.stop();
														}
												},
												t,
												this
											);
										})
									);
									return function () {
										return t.apply(this, arguments);
									};
								})()
							}
						]),
						t
					);
				})(),
				xe = (function (t) {
					(0, f.Z)(r, t);
					var e = (0, l.Z)(r);
					function r(t, n, i, o) {
						var a,
							u = arguments.length > 4 && void 0 !== arguments[4] ? arguments[4] : {};
						return (
							(0, w.Z)(this, r),
							((a = e.call(this)).source = t),
							(a.littleEndian = n),
							(a.bigTiff = i),
							(a.firstIFDOffset = o),
							(a.cache = u.cache || !1),
							(a.ifdRequests = []),
							(a.ghostValues = null),
							a
						);
					}
					return (
						(0, v.Z)(
							r,
							[
								{
									key: 'getSlice',
									value: (function () {
										var t = (0, s.Z)(
											ye().mark(function t(e, r) {
												var n;
												return ye().wrap(
													function (t) {
														for (;;)
															switch ((t.prev = t.next)) {
																case 0:
																	return (
																		(n = this.bigTiff
																			? 4048
																			: 1024),
																		(t.t0 = ue),
																		(t.next = 4),
																		this.source.fetch([
																			{
																				offset: e,
																				length:
																					'undefined' !==
																					typeof r
																						? r
																						: n
																			}
																		])
																	);
																case 4:
																	return (
																		(t.t1 = t.sent[0]),
																		(t.t2 = e),
																		(t.t3 = this.littleEndian),
																		(t.t4 = this.bigTiff),
																		t.abrupt(
																			'return',
																			new t.t0(
																				t.t1,
																				t.t2,
																				t.t3,
																				t.t4
																			)
																		)
																	);
																case 9:
																case 'end':
																	return t.stop();
															}
													},
													t,
													this
												);
											})
										);
										return function (e, r) {
											return t.apply(this, arguments);
										};
									})()
								},
								{
									key: 'parseFileDirectoryAt',
									value: (function () {
										var t = (0, s.Z)(
											ye().mark(function t(e) {
												var r,
													n,
													i,
													o,
													a,
													u,
													c,
													s,
													f,
													l,
													h,
													p,
													y,
													d,
													g,
													v,
													w,
													m,
													b,
													x;
												return ye().wrap(
													function (t) {
														for (;;)
															switch ((t.prev = t.next)) {
																case 0:
																	return (
																		(r = this.bigTiff
																			? 20
																			: 12),
																		(n = this.bigTiff ? 8 : 2),
																		(t.next = 4),
																		this.getSlice(e)
																	);
																case 4:
																	if (
																		((i = t.sent),
																		(o = this.bigTiff
																			? i.readUint64(e)
																			: i.readUint16(e)),
																		(a =
																			o * r +
																			(this.bigTiff
																				? 16
																				: 6)),
																		i.covers(e, a))
																	) {
																		t.next = 11;
																		break;
																	}
																	return (
																		(t.next = 10),
																		this.getSlice(e, a)
																	);
																case 10:
																	i = t.sent;
																case 11:
																	((u = {}),
																		(c =
																			e +
																			(this.bigTiff ? 8 : 2)),
																		(s = 0));
																case 14:
																	if (!(s < o)) {
																		t.next = 41;
																		break;
																	}
																	if (
																		((f = i.readUint16(c)),
																		(l = i.readUint16(c + 2)),
																		(h = this.bigTiff
																			? i.readUint64(c + 4)
																			: i.readUint32(c + 4)),
																		(p = void 0),
																		(y = void 0),
																		(d = de(l)),
																		(g =
																			c +
																			(this.bigTiff
																				? 12
																				: 8)),
																		!(
																			d * h <=
																			(this.bigTiff ? 8 : 4)
																		))
																	) {
																		t.next = 26;
																		break;
																	}
																	((p = ve(i, l, h, g)),
																		(t.next = 36));
																	break;
																case 26:
																	if (
																		((v = i.readOffset(g)),
																		(w = de(l) * h),
																		!i.covers(v, w))
																	) {
																		t.next = 32;
																		break;
																	}
																	((p = ve(i, l, h, v)),
																		(t.next = 36));
																	break;
																case 32:
																	return (
																		(t.next = 34),
																		this.getSlice(v, w)
																	);
																case 34:
																	((m = t.sent),
																		(p = ve(m, l, h, v)));
																case 36:
																	((y =
																		1 === h &&
																		-1 === Dt.It.indexOf(f) &&
																		l !== Dt.sf.RATIONAL &&
																		l !== Dt.sf.SRATIONAL
																			? p[0]
																			: p),
																		(u[Dt.L[f]] = y));
																case 38:
																	((c += r), ++s, (t.next = 14));
																	break;
																case 41:
																	return (
																		(b = ge(u)),
																		(x = i.readOffset(
																			e + n + r * o
																		)),
																		t.abrupt(
																			'return',
																			new we(u, b, x)
																		)
																	);
																case 44:
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
									})()
								},
								{
									key: 'requestIFD',
									value: (function () {
										var t = (0, s.Z)(
											ye().mark(function t(e) {
												var r = this;
												return ye().wrap(
													function (t) {
														for (;;)
															switch ((t.prev = t.next)) {
																case 0:
																	if (!this.ifdRequests[e]) {
																		t.next = 4;
																		break;
																	}
																	return t.abrupt(
																		'return',
																		this.ifdRequests[e]
																	);
																case 4:
																	if (0 !== e) {
																		t.next = 9;
																		break;
																	}
																	return (
																		(this.ifdRequests[e] =
																			this.parseFileDirectoryAt(
																				this.firstIFDOffset
																			)),
																		t.abrupt(
																			'return',
																			this.ifdRequests[e]
																		)
																	);
																case 9:
																	if (this.ifdRequests[e - 1]) {
																		t.next = 19;
																		break;
																	}
																	((t.prev = 10),
																		(this.ifdRequests[e - 1] =
																			this.requestIFD(e - 1)),
																		(t.next = 19));
																	break;
																case 14:
																	if (
																		((t.prev = 14),
																		(t.t0 = t.catch(10)),
																		!(t.t0 instanceof me))
																	) {
																		t.next = 18;
																		break;
																	}
																	throw new me(e);
																case 18:
																	throw t.t0;
																case 19:
																	return (
																		(this.ifdRequests[e] = (0,
																		s.Z)(
																			ye().mark(function t() {
																				var n;
																				return ye().wrap(
																					function (t) {
																						for (;;)
																							switch (
																								(t.prev =
																									t.next)
																							) {
																								case 0:
																									return (
																										(t.next = 2),
																										r
																											.ifdRequests[
																											e -
																												1
																										]
																									);
																								case 2:
																									if (
																										0 !==
																										(n =
																											t.sent)
																											.nextIFDByteOffset
																									) {
																										t.next = 5;
																										break;
																									}
																									throw new me(
																										e
																									);
																								case 5:
																									return t.abrupt(
																										'return',
																										r.parseFileDirectoryAt(
																											n.nextIFDByteOffset
																										)
																									);
																								case 6:
																								case 'end':
																									return t.stop();
																							}
																					},
																					t
																				);
																			})
																		)()),
																		t.abrupt(
																			'return',
																			this.ifdRequests[e]
																		)
																	);
																case 21:
																case 'end':
																	return t.stop();
															}
													},
													t,
													this,
													[[10, 14]]
												);
											})
										);
										return function (e) {
											return t.apply(this, arguments);
										};
									})()
								},
								{
									key: 'getImage',
									value: (function () {
										var t = (0, s.Z)(
											ye().mark(function t() {
												var e,
													r,
													n = arguments;
												return ye().wrap(
													function (t) {
														for (;;)
															switch ((t.prev = t.next)) {
																case 0:
																	return (
																		(e =
																			n.length > 0 &&
																			void 0 !== n[0]
																				? n[0]
																				: 0),
																		(t.next = 3),
																		this.requestIFD(e)
																	);
																case 3:
																	return (
																		(r = t.sent),
																		t.abrupt(
																			'return',
																			new oe(
																				r.fileDirectory,
																				r.geoKeyDirectory,
																				this.dataView,
																				this.littleEndian,
																				this.cache,
																				this.source
																			)
																		)
																	);
																case 5:
																case 'end':
																	return t.stop();
															}
													},
													t,
													this
												);
											})
										);
										return function () {
											return t.apply(this, arguments);
										};
									})()
								},
								{
									key: 'getImageCount',
									value: (function () {
										var t = (0, s.Z)(
											ye().mark(function t() {
												var e, r;
												return ye().wrap(
													function (t) {
														for (;;)
															switch ((t.prev = t.next)) {
																case 0:
																	((e = 0), (r = !0));
																case 2:
																	if (!r) {
																		t.next = 18;
																		break;
																	}
																	return (
																		(t.prev = 3),
																		(t.next = 6),
																		this.requestIFD(e)
																	);
																case 6:
																	(++e, (t.next = 16));
																	break;
																case 9:
																	if (
																		((t.prev = 9),
																		(t.t0 = t.catch(3)),
																		!(t.t0 instanceof me))
																	) {
																		t.next = 15;
																		break;
																	}
																	((r = !1), (t.next = 16));
																	break;
																case 15:
																	throw t.t0;
																case 16:
																	t.next = 2;
																	break;
																case 18:
																	return t.abrupt('return', e);
																case 19:
																case 'end':
																	return t.stop();
															}
													},
													t,
													this,
													[[3, 9]]
												);
											})
										);
										return function () {
											return t.apply(this, arguments);
										};
									})()
								},
								{
									key: 'getGhostValues',
									value: (function () {
										var t = (0, s.Z)(
											ye().mark(function t() {
												var e,
													r,
													n,
													i,
													o,
													a,
													u,
													s,
													f = this;
												return ye().wrap(
													function (t) {
														for (;;)
															switch ((t.prev = t.next)) {
																case 0:
																	if (
																		((e = this.bigTiff
																			? 16
																			: 8),
																		!this.ghostValues)
																	) {
																		t.next = 3;
																		break;
																	}
																	return t.abrupt(
																		'return',
																		this.ghostValues
																	);
																case 3:
																	return (
																		(n =
																			(r =
																				'GDAL_STRUCTURAL_METADATA_SIZE=')
																				.length + 100),
																		(t.next = 7),
																		this.getSlice(e, n)
																	);
																case 7:
																	if (
																		((i = t.sent),
																		r !==
																			ve(
																				i,
																				Dt.sf.ASCII,
																				r.length,
																				e
																			))
																	) {
																		t.next = 19;
																		break;
																	}
																	if (
																		((o = ve(
																			i,
																			Dt.sf.ASCII,
																			n,
																			e
																		)),
																		(a = o.split('\n')[0]),
																		!(
																			(u =
																				Number(
																					a
																						.split(
																							'='
																						)[1]
																						.split(
																							' '
																						)[0]
																				) + a.length) > n
																		))
																	) {
																		t.next = 16;
																		break;
																	}
																	return (
																		(t.next = 15),
																		this.getSlice(e, u)
																	);
																case 15:
																	i = t.sent;
																case 16:
																	((s = ve(i, Dt.sf.ASCII, u, e)),
																		(this.ghostValues = {}),
																		s
																			.split('\n')
																			.filter(function (t) {
																				return t.length > 0;
																			})
																			.map(function (t) {
																				return t.split('=');
																			})
																			.forEach(function (t) {
																				var e = c(t, 2),
																					r = e[0],
																					n = e[1];
																				f.ghostValues[r] =
																					n;
																			}));
																case 19:
																	return t.abrupt(
																		'return',
																		this.ghostValues
																	);
																case 20:
																case 'end':
																	return t.stop();
															}
													},
													t,
													this
												);
											})
										);
										return function () {
											return t.apply(this, arguments);
										};
									})()
								},
								{
									key: 'close',
									value: function () {
										return (
											'function' === typeof this.source.close &&
											this.source.close()
										);
									}
								}
							],
							[
								{
									key: 'fromSource',
									value: (function () {
										var t = (0, s.Z)(
											ye().mark(function t(e, n, i) {
												var o, a, u, c, s, f, l;
												return ye().wrap(function (t) {
													for (;;)
														switch ((t.prev = t.next)) {
															case 0:
																return (
																	(t.next = 2),
																	e.fetch(
																		[
																			{
																				offset: 0,
																				length: 1024
																			}
																		],
																		i
																	)
																);
															case 2:
																if (
																	((o = t.sent[0]),
																	(a = new ae(o)),
																	18761 !==
																		(u = a.getUint16(0, 0)))
																) {
																	t.next = 9;
																	break;
																}
																((c = !0), (t.next = 14));
																break;
															case 9:
																if (19789 !== u) {
																	t.next = 13;
																	break;
																}
																((c = !1), (t.next = 14));
																break;
															case 13:
																throw new TypeError(
																	'Invalid byte order value.'
																);
															case 14:
																if (
																	42 !== (s = a.getUint16(2, c))
																) {
																	t.next = 19;
																	break;
																}
																((f = !1), (t.next = 27));
																break;
															case 19:
																if (43 !== s) {
																	t.next = 26;
																	break;
																}
																if (
																	((f = !0),
																	8 === a.getUint16(4, c))
																) {
																	t.next = 24;
																	break;
																}
																throw new Error(
																	'Unsupported offset byte-size.'
																);
															case 24:
																t.next = 27;
																break;
															case 26:
																throw new TypeError(
																	'Invalid magic number.'
																);
															case 27:
																return (
																	(l = f
																		? a.getUint64(8, c)
																		: a.getUint32(4, c)),
																	t.abrupt(
																		'return',
																		new r(e, c, f, l, n)
																	)
																);
															case 29:
															case 'end':
																return t.stop();
														}
												}, t);
											})
										);
										return function (e, r, n) {
											return t.apply(this, arguments);
										};
									})()
								}
							]
						),
						r
					);
				})(be);
			function ke(t, e) {
				return Ee.apply(this, arguments);
			}
			function Ee() {
				return (Ee = (0, s.Z)(
					ye().mark(function t(e, r) {
						return ye().wrap(function (t) {
							for (;;)
								switch ((t.prev = t.next)) {
									case 0:
										return t.abrupt('return', xe.fromSource(pe(e), r));
									case 1:
									case 'end':
										return t.stop();
								}
						}, t);
					})
				)).apply(this, arguments);
			}
		},
		6825: function (t, e, r) {
			'use strict';
			r.d(e, {
				Ie: function () {
					return f;
				},
				It: function () {
					return a;
				},
				L: function () {
					return n;
				},
				L5: function () {
					return h;
				},
				P1: function () {
					return y;
				},
				Qb: function () {
					return p;
				},
				pd: function () {
					return l;
				},
				sf: function () {
					return c;
				}
			});
			var n = {
					315: 'Artist',
					258: 'BitsPerSample',
					265: 'CellLength',
					264: 'CellWidth',
					320: 'ColorMap',
					259: 'Compression',
					33432: 'Copyright',
					306: 'DateTime',
					338: 'ExtraSamples',
					266: 'FillOrder',
					289: 'FreeByteCounts',
					288: 'FreeOffsets',
					291: 'GrayResponseCurve',
					290: 'GrayResponseUnit',
					316: 'HostComputer',
					270: 'ImageDescription',
					257: 'ImageLength',
					256: 'ImageWidth',
					271: 'Make',
					281: 'MaxSampleValue',
					280: 'MinSampleValue',
					272: 'Model',
					254: 'NewSubfileType',
					274: 'Orientation',
					262: 'PhotometricInterpretation',
					284: 'PlanarConfiguration',
					296: 'ResolutionUnit',
					278: 'RowsPerStrip',
					277: 'SamplesPerPixel',
					305: 'Software',
					279: 'StripByteCounts',
					273: 'StripOffsets',
					255: 'SubfileType',
					263: 'Threshholding',
					282: 'XResolution',
					283: 'YResolution',
					326: 'BadFaxLines',
					327: 'CleanFaxData',
					343: 'ClipPath',
					328: 'ConsecutiveBadFaxLines',
					433: 'Decode',
					434: 'DefaultImageColor',
					269: 'DocumentName',
					336: 'DotRange',
					321: 'HalftoneHints',
					346: 'Indexed',
					347: 'JPEGTables',
					285: 'PageName',
					297: 'PageNumber',
					317: 'Predictor',
					319: 'PrimaryChromaticities',
					532: 'ReferenceBlackWhite',
					339: 'SampleFormat',
					340: 'SMinSampleValue',
					341: 'SMaxSampleValue',
					559: 'StripRowCounts',
					330: 'SubIFDs',
					292: 'T4Options',
					293: 'T6Options',
					325: 'TileByteCounts',
					323: 'TileLength',
					324: 'TileOffsets',
					322: 'TileWidth',
					301: 'TransferFunction',
					318: 'WhitePoint',
					344: 'XClipPathUnits',
					286: 'XPosition',
					529: 'YCbCrCoefficients',
					531: 'YCbCrPositioning',
					530: 'YCbCrSubSampling',
					345: 'YClipPathUnits',
					287: 'YPosition',
					37378: 'ApertureValue',
					40961: 'ColorSpace',
					36868: 'DateTimeDigitized',
					36867: 'DateTimeOriginal',
					34665: 'Exif IFD',
					36864: 'ExifVersion',
					33434: 'ExposureTime',
					41728: 'FileSource',
					37385: 'Flash',
					40960: 'FlashpixVersion',
					33437: 'FNumber',
					42016: 'ImageUniqueID',
					37384: 'LightSource',
					37500: 'MakerNote',
					37377: 'ShutterSpeedValue',
					37510: 'UserComment',
					33723: 'IPTC',
					34675: 'ICC Profile',
					700: 'XMP',
					42112: 'GDAL_METADATA',
					42113: 'GDAL_NODATA',
					34377: 'Photoshop',
					33550: 'ModelPixelScale',
					33922: 'ModelTiepoint',
					34264: 'ModelTransformation',
					34735: 'GeoKeyDirectory',
					34736: 'GeoDoubleParams',
					34737: 'GeoAsciiParams',
					50674: 'LercParameters'
				},
				i = {};
			for (var o in n) n.hasOwnProperty(o) && (i[n[o]] = parseInt(o, 10));
			var a = [
					i.BitsPerSample,
					i.ExtraSamples,
					i.SampleFormat,
					i.StripByteCounts,
					i.StripOffsets,
					i.StripRowCounts,
					i.TileByteCounts,
					i.TileOffsets,
					i.SubIFDs
				],
				u = {
					1: 'BYTE',
					2: 'ASCII',
					3: 'SHORT',
					4: 'LONG',
					5: 'RATIONAL',
					6: 'SBYTE',
					7: 'UNDEFINED',
					8: 'SSHORT',
					9: 'SLONG',
					10: 'SRATIONAL',
					11: 'FLOAT',
					12: 'DOUBLE',
					13: 'IFD',
					16: 'LONG8',
					17: 'SLONG8',
					18: 'IFD8'
				},
				c = {};
			for (var s in u) u.hasOwnProperty(s) && (c[u[s]] = parseInt(s, 10));
			var f = {
					WhiteIsZero: 0,
					BlackIsZero: 1,
					RGB: 2,
					Palette: 3,
					TransparencyMask: 4,
					CMYK: 5,
					YCbCr: 6,
					CIELab: 8,
					ICCLab: 9
				},
				l = { Unspecified: 0, Assocalpha: 1, Unassalpha: 2 },
				h = { Version: 0, AddCompression: 1 },
				p = { None: 0, Deflate: 1 },
				y = {
					1024: 'GTModelTypeGeoKey',
					1025: 'GTRasterTypeGeoKey',
					1026: 'GTCitationGeoKey',
					2048: 'GeographicTypeGeoKey',
					2049: 'GeogCitationGeoKey',
					2050: 'GeogGeodeticDatumGeoKey',
					2051: 'GeogPrimeMeridianGeoKey',
					2052: 'GeogLinearUnitsGeoKey',
					2053: 'GeogLinearUnitSizeGeoKey',
					2054: 'GeogAngularUnitsGeoKey',
					2055: 'GeogAngularUnitSizeGeoKey',
					2056: 'GeogEllipsoidGeoKey',
					2057: 'GeogSemiMajorAxisGeoKey',
					2058: 'GeogSemiMinorAxisGeoKey',
					2059: 'GeogInvFlatteningGeoKey',
					2060: 'GeogAzimuthUnitsGeoKey',
					2061: 'GeogPrimeMeridianLongGeoKey',
					2062: 'GeogTOWGS84GeoKey',
					3072: 'ProjectedCSTypeGeoKey',
					3073: 'PCSCitationGeoKey',
					3074: 'ProjectionGeoKey',
					3075: 'ProjCoordTransGeoKey',
					3076: 'ProjLinearUnitsGeoKey',
					3077: 'ProjLinearUnitSizeGeoKey',
					3078: 'ProjStdParallel1GeoKey',
					3079: 'ProjStdParallel2GeoKey',
					3080: 'ProjNatOriginLongGeoKey',
					3081: 'ProjNatOriginLatGeoKey',
					3082: 'ProjFalseEastingGeoKey',
					3083: 'ProjFalseNorthingGeoKey',
					3084: 'ProjFalseOriginLongGeoKey',
					3085: 'ProjFalseOriginLatGeoKey',
					3086: 'ProjFalseOriginEastingGeoKey',
					3087: 'ProjFalseOriginNorthingGeoKey',
					3088: 'ProjCenterLongGeoKey',
					3089: 'ProjCenterLatGeoKey',
					3090: 'ProjCenterEastingGeoKey',
					3091: 'ProjCenterNorthingGeoKey',
					3092: 'ProjScaleAtNatOriginGeoKey',
					3093: 'ProjScaleAtCenterGeoKey',
					3094: 'ProjAzimuthAngleGeoKey',
					3095: 'ProjStraightVertPoleLongGeoKey',
					3096: 'ProjRectifiedGridAngleGeoKey',
					4096: 'VerticalCSTypeGeoKey',
					4097: 'VerticalCitationGeoKey',
					4098: 'VerticalDatumGeoKey',
					4099: 'VerticalUnitsGeoKey'
				},
				d = {};
			for (var g in y) y.hasOwnProperty(g) && (d[y[g]] = parseInt(g, 10));
		}
	}
]);
