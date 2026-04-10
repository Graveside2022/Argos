/*! For license information please see 592.b150b097.chunk.js.LICENSE.txt */
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
	[592],
	{
		3025: function (t, e, r) {
			r.d(e, {
				Z: function () {
					return h;
				}
			});
			var n = r(4795),
				o = r(9249),
				i = r(7371);
			function a(t, e) {
				var r = t.length - e,
					n = 0;
				do {
					for (var o = e; o > 0; o--) ((t[n + e] += t[n]), n++);
					r -= e;
				} while (r > 0);
			}
			function c(t, e, r) {
				for (var n = 0, o = t.length, i = o / r; o > e; ) {
					for (var a = e; a > 0; --a) ((t[n + e] += t[n]), ++n);
					o -= e;
				}
				for (var c = t.slice(), u = 0; u < i; ++u)
					for (var f = 0; f < r; ++f) t[r * u + f] = c[(r - f - 1) * i + u];
			}
			function u(t, e, r, n, o, i) {
				if (!e || 1 === e) return t;
				for (var u = 0; u < o.length; ++u) {
					if (o[u] % 8 !== 0)
						throw new Error(
							'When decoding with predictor, only multiple of 8 bits are supported.'
						);
					if (o[u] !== o[0])
						throw new Error(
							'When decoding with predictor, all samples must have the same size.'
						);
				}
				for (
					var f = o[0] / 8, h = 2 === i ? 1 : o.length, s = 0;
					s < n && !(s * h * r * f >= t.byteLength);
					++s
				) {
					var l = void 0;
					if (2 === e) {
						switch (o[0]) {
							case 8:
								l = new Uint8Array(t, s * h * r * f, h * r * f);
								break;
							case 16:
								l = new Uint16Array(t, s * h * r * f, (h * r * f) / 2);
								break;
							case 32:
								l = new Uint32Array(t, s * h * r * f, (h * r * f) / 4);
								break;
							default:
								throw new Error(
									'Predictor 2 not allowed with '.concat(
										o[0],
										' bits per sample.'
									)
								);
						}
						a(l, h);
					} else 3 === e && c((l = new Uint8Array(t, s * h * r * f, h * r * f)), h, f);
				}
				return t;
			}
			function f() {
				f = function () {
					return t;
				};
				var t = {},
					e = Object.prototype,
					r = e.hasOwnProperty,
					n = 'function' == typeof Symbol ? Symbol : {},
					o = n.iterator || '@@iterator',
					i = n.asyncIterator || '@@asyncIterator',
					a = n.toStringTag || '@@toStringTag';
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
				} catch (j) {
					c = function (t, e, r) {
						return (t[e] = r);
					};
				}
				function u(t, e, r, n) {
					var o = e && e.prototype instanceof l ? e : l,
						i = Object.create(o.prototype),
						a = new _(n || []);
					return (
						(i._invoke = (function (t, e, r) {
							var n = 'suspendedStart';
							return function (o, i) {
								if ('executing' === n)
									throw new Error('Generator is already running');
								if ('completed' === n) {
									if ('throw' === o) throw i;
									return O();
								}
								for (r.method = o, r.arg = i; ; ) {
									var a = r.delegate;
									if (a) {
										var c = L(a, r);
										if (c) {
											if (c === s) continue;
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
									var u = h(t, e, r);
									if ('normal' === u.type) {
										if (
											((n = r.done ? 'completed' : 'suspendedYield'),
											u.arg === s)
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
				function h(t, e, r) {
					try {
						return { type: 'normal', arg: t.call(e, r) };
					} catch (j) {
						return { type: 'throw', arg: j };
					}
				}
				t.wrap = u;
				var s = {};
				function l() {}
				function p() {}
				function d() {}
				var v = {};
				c(v, o, function () {
					return this;
				});
				var y = Object.getPrototypeOf,
					g = y && y(y(k([])));
				g && g !== e && r.call(g, o) && (v = g);
				var w = (d.prototype = l.prototype = Object.create(v));
				function m(t) {
					['next', 'throw', 'return'].forEach(function (e) {
						c(t, e, function (t) {
							return this._invoke(e, t);
						});
					});
				}
				function b(t, e) {
					function n(o, i, a, c) {
						var u = h(t[o], t, i);
						if ('throw' !== u.type) {
							var f = u.arg,
								s = f.value;
							return s && 'object' == typeof s && r.call(s, '__await')
								? e.resolve(s.__await).then(
										function (t) {
											n('next', t, a, c);
										},
										function (t) {
											n('throw', t, a, c);
										}
									)
								: e.resolve(s).then(
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
				function L(t, e) {
					var r = t.iterator[e.method];
					if (void 0 === r) {
						if (((e.delegate = null), 'throw' === e.method)) {
							if (
								t.iterator.return &&
								((e.method = 'return'),
								(e.arg = void 0),
								L(t, e),
								'throw' === e.method)
							)
								return s;
							((e.method = 'throw'),
								(e.arg = new TypeError(
									"The iterator does not provide a 'throw' method"
								)));
						}
						return s;
					}
					var n = h(r, t.iterator, e.arg);
					if ('throw' === n.type)
						return ((e.method = 'throw'), (e.arg = n.arg), (e.delegate = null), s);
					var o = n.arg;
					return o
						? o.done
							? ((e[t.resultName] = o.value),
								(e.next = t.nextLoc),
								'return' !== e.method && ((e.method = 'next'), (e.arg = void 0)),
								(e.delegate = null),
								s)
							: o
						: ((e.method = 'throw'),
							(e.arg = new TypeError('iterator result is not an object')),
							(e.delegate = null),
							s);
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
				function _(t) {
					((this.tryEntries = [{ tryLoc: 'root' }]), t.forEach(x, this), this.reset(!0));
				}
				function k(t) {
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
					return { next: O };
				}
				function O() {
					return { value: void 0, done: !0 };
				}
				return (
					(p.prototype = d),
					c(w, 'constructor', d),
					c(d, 'constructor', p),
					(p.displayName = c(d, a, 'GeneratorFunction')),
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
								: ((t.__proto__ = d), c(t, a, 'GeneratorFunction')),
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
					(t.async = function (e, r, n, o, i) {
						void 0 === i && (i = Promise);
						var a = new b(u(e, r, n, o), i);
						return t.isGeneratorFunction(r)
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
					(t.values = k),
					(_.prototype = {
						constructor: _,
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
									? ((this.method = 'next'), (this.next = i.finallyLoc), s)
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
								s
							);
						},
						finish: function (t) {
							for (var e = this.tryEntries.length - 1; e >= 0; --e) {
								var r = this.tryEntries[e];
								if (r.finallyLoc === t)
									return (this.complete(r.completion, r.afterLoc), E(r), s);
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
								(this.delegate = { iterator: k(t), resultName: e, nextLoc: r }),
								'next' === this.method && (this.arg = void 0),
								s
							);
						}
					}),
					t
				);
			}
			var h = (function () {
				function t() {
					(0, o.Z)(this, t);
				}
				return (
					(0, i.Z)(t, [
						{
							key: 'decode',
							value: (function () {
								var t = (0, n.Z)(
									f().mark(function t(e, r) {
										var n, o, i, a, c;
										return f().wrap(
											function (t) {
												for (;;)
													switch ((t.prev = t.next)) {
														case 0:
															return (
																(t.next = 2),
																this.decodeBlock(r)
															);
														case 2:
															if (
																((n = t.sent),
																1 === (o = e.Predictor || 1))
															) {
																t.next = 9;
																break;
															}
															return (
																(i = !e.StripOffsets),
																(a = i
																	? e.TileWidth
																	: e.ImageWidth),
																(c = i
																	? e.TileLength
																	: e.RowsPerStrip ||
																		e.ImageLength),
																t.abrupt(
																	'return',
																	u(
																		n,
																		o,
																		a,
																		c,
																		e.BitsPerSample,
																		e.PlanarConfiguration
																	)
																)
															);
														case 9:
															return t.abrupt('return', n);
														case 10:
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
						}
					]),
					t
				);
			})();
		},
		3592: function (t, e, r) {
			(r.r(e),
				r.d(e, {
					default: function () {
						return f;
					}
				}));
			var n = r(4795),
				o = r(9249),
				i = r(7371),
				a = r(5754),
				c = r(6906);
			function u() {
				u = function () {
					return t;
				};
				var t = {},
					e = Object.prototype,
					r = e.hasOwnProperty,
					n = 'function' == typeof Symbol ? Symbol : {},
					o = n.iterator || '@@iterator',
					i = n.asyncIterator || '@@asyncIterator',
					a = n.toStringTag || '@@toStringTag';
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
				} catch (j) {
					c = function (t, e, r) {
						return (t[e] = r);
					};
				}
				function f(t, e, r, n) {
					var o = e && e.prototype instanceof l ? e : l,
						i = Object.create(o.prototype),
						a = new _(n || []);
					return (
						(i._invoke = (function (t, e, r) {
							var n = 'suspendedStart';
							return function (o, i) {
								if ('executing' === n)
									throw new Error('Generator is already running');
								if ('completed' === n) {
									if ('throw' === o) throw i;
									return O();
								}
								for (r.method = o, r.arg = i; ; ) {
									var a = r.delegate;
									if (a) {
										var c = L(a, r);
										if (c) {
											if (c === s) continue;
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
									var u = h(t, e, r);
									if ('normal' === u.type) {
										if (
											((n = r.done ? 'completed' : 'suspendedYield'),
											u.arg === s)
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
				function h(t, e, r) {
					try {
						return { type: 'normal', arg: t.call(e, r) };
					} catch (j) {
						return { type: 'throw', arg: j };
					}
				}
				t.wrap = f;
				var s = {};
				function l() {}
				function p() {}
				function d() {}
				var v = {};
				c(v, o, function () {
					return this;
				});
				var y = Object.getPrototypeOf,
					g = y && y(y(k([])));
				g && g !== e && r.call(g, o) && (v = g);
				var w = (d.prototype = l.prototype = Object.create(v));
				function m(t) {
					['next', 'throw', 'return'].forEach(function (e) {
						c(t, e, function (t) {
							return this._invoke(e, t);
						});
					});
				}
				function b(t, e) {
					function n(o, i, a, c) {
						var u = h(t[o], t, i);
						if ('throw' !== u.type) {
							var f = u.arg,
								s = f.value;
							return s && 'object' == typeof s && r.call(s, '__await')
								? e.resolve(s.__await).then(
										function (t) {
											n('next', t, a, c);
										},
										function (t) {
											n('throw', t, a, c);
										}
									)
								: e.resolve(s).then(
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
				function L(t, e) {
					var r = t.iterator[e.method];
					if (void 0 === r) {
						if (((e.delegate = null), 'throw' === e.method)) {
							if (
								t.iterator.return &&
								((e.method = 'return'),
								(e.arg = void 0),
								L(t, e),
								'throw' === e.method)
							)
								return s;
							((e.method = 'throw'),
								(e.arg = new TypeError(
									"The iterator does not provide a 'throw' method"
								)));
						}
						return s;
					}
					var n = h(r, t.iterator, e.arg);
					if ('throw' === n.type)
						return ((e.method = 'throw'), (e.arg = n.arg), (e.delegate = null), s);
					var o = n.arg;
					return o
						? o.done
							? ((e[t.resultName] = o.value),
								(e.next = t.nextLoc),
								'return' !== e.method && ((e.method = 'next'), (e.arg = void 0)),
								(e.delegate = null),
								s)
							: o
						: ((e.method = 'throw'),
							(e.arg = new TypeError('iterator result is not an object')),
							(e.delegate = null),
							s);
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
				function _(t) {
					((this.tryEntries = [{ tryLoc: 'root' }]), t.forEach(x, this), this.reset(!0));
				}
				function k(t) {
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
					return { next: O };
				}
				function O() {
					return { value: void 0, done: !0 };
				}
				return (
					(p.prototype = d),
					c(w, 'constructor', d),
					c(d, 'constructor', p),
					(p.displayName = c(d, a, 'GeneratorFunction')),
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
								: ((t.__proto__ = d), c(t, a, 'GeneratorFunction')),
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
					c(w, a, 'Generator'),
					c(w, o, function () {
						return this;
					}),
					c(w, 'toString', function () {
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
					(t.values = k),
					(_.prototype = {
						constructor: _,
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
									? ((this.method = 'next'), (this.next = i.finallyLoc), s)
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
								s
							);
						},
						finish: function (t) {
							for (var e = this.tryEntries.length - 1; e >= 0; --e) {
								var r = this.tryEntries[e];
								if (r.finallyLoc === t)
									return (this.complete(r.completion, r.afterLoc), E(r), s);
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
								(this.delegate = { iterator: k(t), resultName: e, nextLoc: r }),
								'next' === this.method && (this.arg = void 0),
								s
							);
						}
					}),
					t
				);
			}
			var f = (function (t) {
				(0, a.Z)(r, t);
				var e = (0, c.Z)(r);
				function r() {
					var t;
					if (
						((0, o.Z)(this, r),
						(t = e.call(this)),
						'undefined' === typeof createImageBitmap)
					)
						throw new Error(
							'Cannot decode WebImage as `createImageBitmap` is not available'
						);
					if ('undefined' === typeof document && 'undefined' === typeof OffscreenCanvas)
						throw new Error(
							'Cannot decode WebImage as neither `document` nor `OffscreenCanvas` is not available'
						);
					return t;
				}
				return (
					(0, i.Z)(r, [
						{
							key: 'decode',
							value: (function () {
								var t = (0, n.Z)(
									u().mark(function t(e, r) {
										var n, o, i, a;
										return u().wrap(function (t) {
											for (;;)
												switch ((t.prev = t.next)) {
													case 0:
														return (
															(n = new Blob([r])),
															(t.next = 3),
															createImageBitmap(n)
														);
													case 3:
														return (
															(o = t.sent),
															'undefined' !== typeof document
																? (((i =
																		document.createElement(
																			'canvas'
																		)).width = o.width),
																	(i.height = o.height))
																: (i = new OffscreenCanvas(
																		o.width,
																		o.height
																	)),
															(a = i.getContext('2d')).drawImage(
																o,
																0,
																0
															),
															t.abrupt(
																'return',
																a.getImageData(
																	0,
																	0,
																	o.width,
																	o.height
																).data.buffer
															)
														);
													case 8:
													case 'end':
														return t.stop();
												}
										}, t);
									})
								);
								return function (e, r) {
									return t.apply(this, arguments);
								};
							})()
						}
					]),
					r
				);
			})(r(3025).Z);
		}
	}
]);
