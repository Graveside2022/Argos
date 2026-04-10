/*! For license information please see 787.6d0a7299.chunk.js.LICENSE.txt */
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
	[787],
	{
		3025: function (t, r, e) {
			e.d(r, {
				Z: function () {
					return h;
				}
			});
			var n = e(4795),
				o = e(9249),
				i = e(7371);
			function a(t, r) {
				var e = t.length - r,
					n = 0;
				do {
					for (var o = r; o > 0; o--) ((t[n + r] += t[n]), n++);
					e -= r;
				} while (e > 0);
			}
			function c(t, r, e) {
				for (var n = 0, o = t.length, i = o / e; o > r; ) {
					for (var a = r; a > 0; --a) ((t[n + r] += t[n]), ++n);
					o -= r;
				}
				for (var c = t.slice(), u = 0; u < i; ++u)
					for (var f = 0; f < e; ++f) t[e * u + f] = c[(e - f - 1) * i + u];
			}
			function u(t, r, e, n, o, i) {
				if (!r || 1 === r) return t;
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
					var f = o[0] / 8, h = 2 === i ? 1 : o.length, l = 0;
					l < n && !(l * h * e * f >= t.byteLength);
					++l
				) {
					var s = void 0;
					if (2 === r) {
						switch (o[0]) {
							case 8:
								s = new Uint8Array(t, l * h * e * f, h * e * f);
								break;
							case 16:
								s = new Uint16Array(t, l * h * e * f, (h * e * f) / 2);
								break;
							case 32:
								s = new Uint32Array(t, l * h * e * f, (h * e * f) / 4);
								break;
							default:
								throw new Error(
									'Predictor 2 not allowed with '.concat(
										o[0],
										' bits per sample.'
									)
								);
						}
						a(s, h);
					} else 3 === r && c((s = new Uint8Array(t, l * h * e * f, h * e * f)), h, f);
				}
				return t;
			}
			function f() {
				f = function () {
					return t;
				};
				var t = {},
					r = Object.prototype,
					e = r.hasOwnProperty,
					n = 'function' == typeof Symbol ? Symbol : {},
					o = n.iterator || '@@iterator',
					i = n.asyncIterator || '@@asyncIterator',
					a = n.toStringTag || '@@toStringTag';
				function c(t, r, e) {
					return (
						Object.defineProperty(t, r, {
							value: e,
							enumerable: !0,
							configurable: !0,
							writable: !0
						}),
						t[r]
					);
				}
				try {
					c({}, '');
				} catch (j) {
					c = function (t, r, e) {
						return (t[r] = e);
					};
				}
				function u(t, r, e, n) {
					var o = r && r.prototype instanceof s ? r : s,
						i = Object.create(o.prototype),
						a = new k(n || []);
					return (
						(i._invoke = (function (t, r, e) {
							var n = 'suspendedStart';
							return function (o, i) {
								if ('executing' === n)
									throw new Error('Generator is already running');
								if ('completed' === n) {
									if ('throw' === o) throw i;
									return O();
								}
								for (e.method = o, e.arg = i; ; ) {
									var a = e.delegate;
									if (a) {
										var c = L(a, e);
										if (c) {
											if (c === l) continue;
											return c;
										}
									}
									if ('next' === e.method) e.sent = e._sent = e.arg;
									else if ('throw' === e.method) {
										if ('suspendedStart' === n)
											throw ((n = 'completed'), e.arg);
										e.dispatchException(e.arg);
									} else 'return' === e.method && e.abrupt('return', e.arg);
									n = 'executing';
									var u = h(t, r, e);
									if ('normal' === u.type) {
										if (
											((n = e.done ? 'completed' : 'suspendedYield'),
											u.arg === l)
										)
											continue;
										return { value: u.arg, done: e.done };
									}
									'throw' === u.type &&
										((n = 'completed'), (e.method = 'throw'), (e.arg = u.arg));
								}
							};
						})(t, e, a)),
						i
					);
				}
				function h(t, r, e) {
					try {
						return { type: 'normal', arg: t.call(r, e) };
					} catch (j) {
						return { type: 'throw', arg: j };
					}
				}
				t.wrap = u;
				var l = {};
				function s() {}
				function p() {}
				function d() {}
				var v = {};
				c(v, o, function () {
					return this;
				});
				var y = Object.getPrototypeOf,
					g = y && y(y(_([])));
				g && g !== r && e.call(g, o) && (v = g);
				var w = (d.prototype = s.prototype = Object.create(v));
				function m(t) {
					['next', 'throw', 'return'].forEach(function (r) {
						c(t, r, function (t) {
							return this._invoke(r, t);
						});
					});
				}
				function b(t, r) {
					function n(o, i, a, c) {
						var u = h(t[o], t, i);
						if ('throw' !== u.type) {
							var f = u.arg,
								l = f.value;
							return l && 'object' == typeof l && e.call(l, '__await')
								? r.resolve(l.__await).then(
										function (t) {
											n('next', t, a, c);
										},
										function (t) {
											n('throw', t, a, c);
										}
									)
								: r.resolve(l).then(
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
					this._invoke = function (t, e) {
						function i() {
							return new r(function (r, o) {
								n(t, e, r, o);
							});
						}
						return (o = o ? o.then(i, i) : i());
					};
				}
				function L(t, r) {
					var e = t.iterator[r.method];
					if (void 0 === e) {
						if (((r.delegate = null), 'throw' === r.method)) {
							if (
								t.iterator.return &&
								((r.method = 'return'),
								(r.arg = void 0),
								L(t, r),
								'throw' === r.method)
							)
								return l;
							((r.method = 'throw'),
								(r.arg = new TypeError(
									"The iterator does not provide a 'throw' method"
								)));
						}
						return l;
					}
					var n = h(e, t.iterator, r.arg);
					if ('throw' === n.type)
						return ((r.method = 'throw'), (r.arg = n.arg), (r.delegate = null), l);
					var o = n.arg;
					return o
						? o.done
							? ((r[t.resultName] = o.value),
								(r.next = t.nextLoc),
								'return' !== r.method && ((r.method = 'next'), (r.arg = void 0)),
								(r.delegate = null),
								l)
							: o
						: ((r.method = 'throw'),
							(r.arg = new TypeError('iterator result is not an object')),
							(r.delegate = null),
							l);
				}
				function x(t) {
					var r = { tryLoc: t[0] };
					(1 in t && (r.catchLoc = t[1]),
						2 in t && ((r.finallyLoc = t[2]), (r.afterLoc = t[3])),
						this.tryEntries.push(r));
				}
				function E(t) {
					var r = t.completion || {};
					((r.type = 'normal'), delete r.arg, (t.completion = r));
				}
				function k(t) {
					((this.tryEntries = [{ tryLoc: 'root' }]), t.forEach(x, this), this.reset(!0));
				}
				function _(t) {
					if (t) {
						var r = t[o];
						if (r) return r.call(t);
						if ('function' == typeof t.next) return t;
						if (!isNaN(t.length)) {
							var n = -1,
								i = function r() {
									for (; ++n < t.length; )
										if (e.call(t, n))
											return ((r.value = t[n]), (r.done = !1), r);
									return ((r.value = void 0), (r.done = !0), r);
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
						var r = 'function' == typeof t && t.constructor;
						return (
							!!r && (r === p || 'GeneratorFunction' === (r.displayName || r.name))
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
					(t.async = function (r, e, n, o, i) {
						void 0 === i && (i = Promise);
						var a = new b(u(r, e, n, o), i);
						return t.isGeneratorFunction(e)
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
						var r = [];
						for (var e in t) r.push(e);
						return (
							r.reverse(),
							function e() {
								for (; r.length; ) {
									var n = r.pop();
									if (n in t) return ((e.value = n), (e.done = !1), e);
								}
								return ((e.done = !0), e);
							}
						);
					}),
					(t.values = _),
					(k.prototype = {
						constructor: k,
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
								for (var r in this)
									't' === r.charAt(0) &&
										e.call(this, r) &&
										!isNaN(+r.slice(1)) &&
										(this[r] = void 0);
						},
						stop: function () {
							this.done = !0;
							var t = this.tryEntries[0].completion;
							if ('throw' === t.type) throw t.arg;
							return this.rval;
						},
						dispatchException: function (t) {
							if (this.done) throw t;
							var r = this;
							function n(e, n) {
								return (
									(a.type = 'throw'),
									(a.arg = t),
									(r.next = e),
									n && ((r.method = 'next'), (r.arg = void 0)),
									!!n
								);
							}
							for (var o = this.tryEntries.length - 1; o >= 0; --o) {
								var i = this.tryEntries[o],
									a = i.completion;
								if ('root' === i.tryLoc) return n('end');
								if (i.tryLoc <= this.prev) {
									var c = e.call(i, 'catchLoc'),
										u = e.call(i, 'finallyLoc');
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
						abrupt: function (t, r) {
							for (var n = this.tryEntries.length - 1; n >= 0; --n) {
								var o = this.tryEntries[n];
								if (
									o.tryLoc <= this.prev &&
									e.call(o, 'finallyLoc') &&
									this.prev < o.finallyLoc
								) {
									var i = o;
									break;
								}
							}
							i &&
								('break' === t || 'continue' === t) &&
								i.tryLoc <= r &&
								r <= i.finallyLoc &&
								(i = null);
							var a = i ? i.completion : {};
							return (
								(a.type = t),
								(a.arg = r),
								i
									? ((this.method = 'next'), (this.next = i.finallyLoc), l)
									: this.complete(a)
							);
						},
						complete: function (t, r) {
							if ('throw' === t.type) throw t.arg;
							return (
								'break' === t.type || 'continue' === t.type
									? (this.next = t.arg)
									: 'return' === t.type
										? ((this.rval = this.arg = t.arg),
											(this.method = 'return'),
											(this.next = 'end'))
										: 'normal' === t.type && r && (this.next = r),
								l
							);
						},
						finish: function (t) {
							for (var r = this.tryEntries.length - 1; r >= 0; --r) {
								var e = this.tryEntries[r];
								if (e.finallyLoc === t)
									return (this.complete(e.completion, e.afterLoc), E(e), l);
							}
						},
						catch: function (t) {
							for (var r = this.tryEntries.length - 1; r >= 0; --r) {
								var e = this.tryEntries[r];
								if (e.tryLoc === t) {
									var n = e.completion;
									if ('throw' === n.type) {
										var o = n.arg;
										E(e);
									}
									return o;
								}
							}
							throw new Error('illegal catch attempt');
						},
						delegateYield: function (t, r, e) {
							return (
								(this.delegate = { iterator: _(t), resultName: r, nextLoc: e }),
								'next' === this.method && (this.arg = void 0),
								l
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
									f().mark(function t(r, e) {
										var n, o, i, a, c;
										return f().wrap(
											function (t) {
												for (;;)
													switch ((t.prev = t.next)) {
														case 0:
															return (
																(t.next = 2),
																this.decodeBlock(e)
															);
														case 2:
															if (
																((n = t.sent),
																1 === (o = r.Predictor || 1))
															) {
																t.next = 9;
																break;
															}
															return (
																(i = !r.StripOffsets),
																(a = i
																	? r.TileWidth
																	: r.ImageWidth),
																(c = i
																	? r.TileLength
																	: r.RowsPerStrip ||
																		r.ImageLength),
																t.abrupt(
																	'return',
																	u(
																		n,
																		o,
																		a,
																		c,
																		r.BitsPerSample,
																		r.PlanarConfiguration
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
								return function (r, e) {
									return t.apply(this, arguments);
								};
							})()
						}
					]),
					t
				);
			})();
		},
		4787: function (t, r, e) {
			(e.r(r),
				e.d(r, {
					default: function () {
						return c;
					}
				}));
			var n = e(9249),
				o = e(7371),
				i = e(5754),
				a = e(6906),
				c = (function (t) {
					(0, i.Z)(e, t);
					var r = (0, a.Z)(e);
					function e() {
						return ((0, n.Z)(this, e), r.apply(this, arguments));
					}
					return (
						(0, o.Z)(e, [
							{
								key: 'decodeBlock',
								value: function (t) {
									for (
										var r = new DataView(t), e = [], n = 0;
										n < t.byteLength;
										++n
									) {
										var o = r.getInt8(n);
										if (o < 0) {
											var i = r.getUint8(n + 1);
											o = -o;
											for (var a = 0; a <= o; ++a) e.push(i);
											n += 1;
										} else {
											for (var c = 0; c <= o; ++c)
												e.push(r.getUint8(n + c + 1));
											n += o + 1;
										}
									}
									return new Uint8Array(e).buffer;
								}
							}
						]),
						e
					);
				})(e(3025).Z);
		}
	}
]);
