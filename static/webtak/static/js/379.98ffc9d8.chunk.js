/*! For license information please see 379.98ffc9d8.chunk.js.LICENSE.txt */
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
	[379],
	{
		3025: function (r, e, t) {
			t.d(e, {
				Z: function () {
					return u;
				}
			});
			var n = t(4795),
				o = t(9249),
				a = t(7371);
			function i(r, e) {
				var t = r.length - e,
					n = 0;
				do {
					for (var o = e; o > 0; o--) ((r[n + e] += r[n]), n++);
					t -= e;
				} while (t > 0);
			}
			function s(r, e, t) {
				for (var n = 0, o = r.length, a = o / t; o > e; ) {
					for (var i = e; i > 0; --i) ((r[n + e] += r[n]), ++n);
					o -= e;
				}
				for (var s = r.slice(), c = 0; c < a; ++c)
					for (var f = 0; f < t; ++f) r[t * c + f] = s[(t - f - 1) * a + c];
			}
			function c(r, e, t, n, o, a) {
				if (!e || 1 === e) return r;
				for (var c = 0; c < o.length; ++c) {
					if (o[c] % 8 !== 0)
						throw new Error(
							'When decoding with predictor, only multiple of 8 bits are supported.'
						);
					if (o[c] !== o[0])
						throw new Error(
							'When decoding with predictor, all samples must have the same size.'
						);
				}
				for (
					var f = o[0] / 8, u = 2 === a ? 1 : o.length, h = 0;
					h < n && !(h * u * t * f >= r.byteLength);
					++h
				) {
					var l = void 0;
					if (2 === e) {
						switch (o[0]) {
							case 8:
								l = new Uint8Array(r, h * u * t * f, u * t * f);
								break;
							case 16:
								l = new Uint16Array(r, h * u * t * f, (u * t * f) / 2);
								break;
							case 32:
								l = new Uint32Array(r, h * u * t * f, (u * t * f) / 4);
								break;
							default:
								throw new Error(
									'Predictor 2 not allowed with '.concat(
										o[0],
										' bits per sample.'
									)
								);
						}
						i(l, u);
					} else 3 === e && s((l = new Uint8Array(r, h * u * t * f, u * t * f)), u, f);
				}
				return r;
			}
			function f() {
				f = function () {
					return r;
				};
				var r = {},
					e = Object.prototype,
					t = e.hasOwnProperty,
					n = 'function' == typeof Symbol ? Symbol : {},
					o = n.iterator || '@@iterator',
					a = n.asyncIterator || '@@asyncIterator',
					i = n.toStringTag || '@@toStringTag';
				function s(r, e, t) {
					return (
						Object.defineProperty(r, e, {
							value: t,
							enumerable: !0,
							configurable: !0,
							writable: !0
						}),
						r[e]
					);
				}
				try {
					s({}, '');
				} catch (A) {
					s = function (r, e, t) {
						return (r[e] = t);
					};
				}
				function c(r, e, t, n) {
					var o = e && e.prototype instanceof l ? e : l,
						a = Object.create(o.prototype),
						i = new E(n || []);
					return (
						(a._invoke = (function (r, e, t) {
							var n = 'suspendedStart';
							return function (o, a) {
								if ('executing' === n)
									throw new Error('Generator is already running');
								if ('completed' === n) {
									if ('throw' === o) throw a;
									return T();
								}
								for (t.method = o, t.arg = a; ; ) {
									var i = t.delegate;
									if (i) {
										var s = k(i, t);
										if (s) {
											if (s === h) continue;
											return s;
										}
									}
									if ('next' === t.method) t.sent = t._sent = t.arg;
									else if ('throw' === t.method) {
										if ('suspendedStart' === n)
											throw ((n = 'completed'), t.arg);
										t.dispatchException(t.arg);
									} else 'return' === t.method && t.abrupt('return', t.arg);
									n = 'executing';
									var c = u(r, e, t);
									if ('normal' === c.type) {
										if (
											((n = t.done ? 'completed' : 'suspendedYield'),
											c.arg === h)
										)
											continue;
										return { value: c.arg, done: t.done };
									}
									'throw' === c.type &&
										((n = 'completed'), (t.method = 'throw'), (t.arg = c.arg));
								}
							};
						})(r, t, i)),
						a
					);
				}
				function u(r, e, t) {
					try {
						return { type: 'normal', arg: r.call(e, t) };
					} catch (A) {
						return { type: 'throw', arg: A };
					}
				}
				r.wrap = c;
				var h = {};
				function l() {}
				function v() {}
				function d() {}
				var p = {};
				s(p, o, function () {
					return this;
				});
				var m = Object.getPrototypeOf,
					y = m && m(m(P([])));
				y && y !== e && t.call(y, o) && (p = y);
				var w = (d.prototype = l.prototype = Object.create(p));
				function b(r) {
					['next', 'throw', 'return'].forEach(function (e) {
						s(r, e, function (r) {
							return this._invoke(e, r);
						});
					});
				}
				function g(r, e) {
					function n(o, a, i, s) {
						var c = u(r[o], r, a);
						if ('throw' !== c.type) {
							var f = c.arg,
								h = f.value;
							return h && 'object' == typeof h && t.call(h, '__await')
								? e.resolve(h.__await).then(
										function (r) {
											n('next', r, i, s);
										},
										function (r) {
											n('throw', r, i, s);
										}
									)
								: e.resolve(h).then(
										function (r) {
											((f.value = r), i(f));
										},
										function (r) {
											return n('throw', r, i, s);
										}
									);
						}
						s(c.arg);
					}
					var o;
					this._invoke = function (r, t) {
						function a() {
							return new e(function (e, o) {
								n(r, t, e, o);
							});
						}
						return (o = o ? o.then(a, a) : a());
					};
				}
				function k(r, e) {
					var t = r.iterator[e.method];
					if (void 0 === t) {
						if (((e.delegate = null), 'throw' === e.method)) {
							if (
								r.iterator.return &&
								((e.method = 'return'),
								(e.arg = void 0),
								k(r, e),
								'throw' === e.method)
							)
								return h;
							((e.method = 'throw'),
								(e.arg = new TypeError(
									"The iterator does not provide a 'throw' method"
								)));
						}
						return h;
					}
					var n = u(t, r.iterator, e.arg);
					if ('throw' === n.type)
						return ((e.method = 'throw'), (e.arg = n.arg), (e.delegate = null), h);
					var o = n.arg;
					return o
						? o.done
							? ((e[r.resultName] = o.value),
								(e.next = r.nextLoc),
								'return' !== e.method && ((e.method = 'next'), (e.arg = void 0)),
								(e.delegate = null),
								h)
							: o
						: ((e.method = 'throw'),
							(e.arg = new TypeError('iterator result is not an object')),
							(e.delegate = null),
							h);
				}
				function x(r) {
					var e = { tryLoc: r[0] };
					(1 in r && (e.catchLoc = r[1]),
						2 in r && ((e.finallyLoc = r[2]), (e.afterLoc = r[3])),
						this.tryEntries.push(e));
				}
				function L(r) {
					var e = r.completion || {};
					((e.type = 'normal'), delete e.arg, (r.completion = e));
				}
				function E(r) {
					((this.tryEntries = [{ tryLoc: 'root' }]), r.forEach(x, this), this.reset(!0));
				}
				function P(r) {
					if (r) {
						var e = r[o];
						if (e) return e.call(r);
						if ('function' == typeof r.next) return r;
						if (!isNaN(r.length)) {
							var n = -1,
								a = function e() {
									for (; ++n < r.length; )
										if (t.call(r, n))
											return ((e.value = r[n]), (e.done = !1), e);
									return ((e.value = void 0), (e.done = !0), e);
								};
							return (a.next = a);
						}
					}
					return { next: T };
				}
				function T() {
					return { value: void 0, done: !0 };
				}
				return (
					(v.prototype = d),
					s(w, 'constructor', d),
					s(d, 'constructor', v),
					(v.displayName = s(d, i, 'GeneratorFunction')),
					(r.isGeneratorFunction = function (r) {
						var e = 'function' == typeof r && r.constructor;
						return (
							!!e && (e === v || 'GeneratorFunction' === (e.displayName || e.name))
						);
					}),
					(r.mark = function (r) {
						return (
							Object.setPrototypeOf
								? Object.setPrototypeOf(r, d)
								: ((r.__proto__ = d), s(r, i, 'GeneratorFunction')),
							(r.prototype = Object.create(w)),
							r
						);
					}),
					(r.awrap = function (r) {
						return { __await: r };
					}),
					b(g.prototype),
					s(g.prototype, a, function () {
						return this;
					}),
					(r.AsyncIterator = g),
					(r.async = function (e, t, n, o, a) {
						void 0 === a && (a = Promise);
						var i = new g(c(e, t, n, o), a);
						return r.isGeneratorFunction(t)
							? i
							: i.next().then(function (r) {
									return r.done ? r.value : i.next();
								});
					}),
					b(w),
					s(w, i, 'Generator'),
					s(w, o, function () {
						return this;
					}),
					s(w, 'toString', function () {
						return '[object Generator]';
					}),
					(r.keys = function (r) {
						var e = [];
						for (var t in r) e.push(t);
						return (
							e.reverse(),
							function t() {
								for (; e.length; ) {
									var n = e.pop();
									if (n in r) return ((t.value = n), (t.done = !1), t);
								}
								return ((t.done = !0), t);
							}
						);
					}),
					(r.values = P),
					(E.prototype = {
						constructor: E,
						reset: function (r) {
							if (
								((this.prev = 0),
								(this.next = 0),
								(this.sent = this._sent = void 0),
								(this.done = !1),
								(this.delegate = null),
								(this.method = 'next'),
								(this.arg = void 0),
								this.tryEntries.forEach(L),
								!r)
							)
								for (var e in this)
									't' === e.charAt(0) &&
										t.call(this, e) &&
										!isNaN(+e.slice(1)) &&
										(this[e] = void 0);
						},
						stop: function () {
							this.done = !0;
							var r = this.tryEntries[0].completion;
							if ('throw' === r.type) throw r.arg;
							return this.rval;
						},
						dispatchException: function (r) {
							if (this.done) throw r;
							var e = this;
							function n(t, n) {
								return (
									(i.type = 'throw'),
									(i.arg = r),
									(e.next = t),
									n && ((e.method = 'next'), (e.arg = void 0)),
									!!n
								);
							}
							for (var o = this.tryEntries.length - 1; o >= 0; --o) {
								var a = this.tryEntries[o],
									i = a.completion;
								if ('root' === a.tryLoc) return n('end');
								if (a.tryLoc <= this.prev) {
									var s = t.call(a, 'catchLoc'),
										c = t.call(a, 'finallyLoc');
									if (s && c) {
										if (this.prev < a.catchLoc) return n(a.catchLoc, !0);
										if (this.prev < a.finallyLoc) return n(a.finallyLoc);
									} else if (s) {
										if (this.prev < a.catchLoc) return n(a.catchLoc, !0);
									} else {
										if (!c)
											throw new Error(
												'try statement without catch or finally'
											);
										if (this.prev < a.finallyLoc) return n(a.finallyLoc);
									}
								}
							}
						},
						abrupt: function (r, e) {
							for (var n = this.tryEntries.length - 1; n >= 0; --n) {
								var o = this.tryEntries[n];
								if (
									o.tryLoc <= this.prev &&
									t.call(o, 'finallyLoc') &&
									this.prev < o.finallyLoc
								) {
									var a = o;
									break;
								}
							}
							a &&
								('break' === r || 'continue' === r) &&
								a.tryLoc <= e &&
								e <= a.finallyLoc &&
								(a = null);
							var i = a ? a.completion : {};
							return (
								(i.type = r),
								(i.arg = e),
								a
									? ((this.method = 'next'), (this.next = a.finallyLoc), h)
									: this.complete(i)
							);
						},
						complete: function (r, e) {
							if ('throw' === r.type) throw r.arg;
							return (
								'break' === r.type || 'continue' === r.type
									? (this.next = r.arg)
									: 'return' === r.type
										? ((this.rval = this.arg = r.arg),
											(this.method = 'return'),
											(this.next = 'end'))
										: 'normal' === r.type && e && (this.next = e),
								h
							);
						},
						finish: function (r) {
							for (var e = this.tryEntries.length - 1; e >= 0; --e) {
								var t = this.tryEntries[e];
								if (t.finallyLoc === r)
									return (this.complete(t.completion, t.afterLoc), L(t), h);
							}
						},
						catch: function (r) {
							for (var e = this.tryEntries.length - 1; e >= 0; --e) {
								var t = this.tryEntries[e];
								if (t.tryLoc === r) {
									var n = t.completion;
									if ('throw' === n.type) {
										var o = n.arg;
										L(t);
									}
									return o;
								}
							}
							throw new Error('illegal catch attempt');
						},
						delegateYield: function (r, e, t) {
							return (
								(this.delegate = { iterator: P(r), resultName: e, nextLoc: t }),
								'next' === this.method && (this.arg = void 0),
								h
							);
						}
					}),
					r
				);
			}
			var u = (function () {
				function r() {
					(0, o.Z)(this, r);
				}
				return (
					(0, a.Z)(r, [
						{
							key: 'decode',
							value: (function () {
								var r = (0, n.Z)(
									f().mark(function r(e, t) {
										var n, o, a, i, s;
										return f().wrap(
											function (r) {
												for (;;)
													switch ((r.prev = r.next)) {
														case 0:
															return (
																(r.next = 2),
																this.decodeBlock(t)
															);
														case 2:
															if (
																((n = r.sent),
																1 === (o = e.Predictor || 1))
															) {
																r.next = 9;
																break;
															}
															return (
																(a = !e.StripOffsets),
																(i = a
																	? e.TileWidth
																	: e.ImageWidth),
																(s = a
																	? e.TileLength
																	: e.RowsPerStrip ||
																		e.ImageLength),
																r.abrupt(
																	'return',
																	c(
																		n,
																		o,
																		i,
																		s,
																		e.BitsPerSample,
																		e.PlanarConfiguration
																	)
																)
															);
														case 9:
															return r.abrupt('return', n);
														case 10:
														case 'end':
															return r.stop();
													}
											},
											r,
											this
										);
									})
								);
								return function (e, t) {
									return r.apply(this, arguments);
								};
							})()
						}
					]),
					r
				);
			})();
		},
		7379: function (r, e, t) {
			(t.r(e),
				t.d(e, {
					default: function () {
						return k;
					}
				}));
			var n = t(5754),
				o = t(6906),
				a = t(9249),
				i = t(7371),
				s = t(3025),
				c = new Int32Array([
					0, 1, 8, 16, 9, 2, 3, 10, 17, 24, 32, 25, 18, 11, 4, 5, 12, 19, 26, 33, 40, 48,
					41, 34, 27, 20, 13, 6, 7, 14, 21, 28, 35, 42, 49, 56, 57, 50, 43, 36, 29, 22,
					15, 23, 30, 37, 44, 51, 58, 59, 52, 45, 38, 31, 39, 46, 53, 60, 61, 54, 47, 55,
					62, 63
				]),
				f = 4017,
				u = 799,
				h = 3406,
				l = 2276,
				v = 1567,
				d = 3784,
				p = 5793,
				m = 2896;
			function y(r, e) {
				for (var t = 0, n = [], o = 16; o > 0 && !r[o - 1]; ) --o;
				n.push({ children: [], index: 0 });
				for (var a, i = n[0], s = 0; s < o; s++) {
					for (var c = 0; c < r[s]; c++) {
						for ((i = n.pop()).children[i.index] = e[t]; i.index > 0; ) i = n.pop();
						for (i.index++, n.push(i); n.length <= s; )
							(n.push((a = { children: [], index: 0 })),
								(i.children[i.index] = a.children),
								(i = a));
						t++;
					}
					s + 1 < o &&
						(n.push((a = { children: [], index: 0 })),
						(i.children[i.index] = a.children),
						(i = a));
				}
				return n[0].children;
			}
			function w(r, e, t, n, o, a, i, s, f) {
				var u = t.mcusPerLine,
					h = t.progressive,
					l = e,
					v = e,
					d = 0,
					p = 0;
				function m() {
					if (p > 0) return (p--, (d >> p) & 1);
					if (255 === (d = r[v++])) {
						var e = r[v++];
						if (e)
							throw new Error(
								'unexpected marker: '.concat(((d << 8) | e).toString(16))
							);
					}
					return ((p = 7), d >>> 7);
				}
				function y(r) {
					for (var e, t = r; null !== (e = m()); ) {
						if ('number' === typeof (t = t[e])) return t;
						if ('object' !== typeof t) throw new Error('invalid huffman sequence');
					}
					return null;
				}
				function w(r) {
					for (var e = r, t = 0; e > 0; ) {
						var n = m();
						if (null === n) return;
						((t = (t << 1) | n), --e);
					}
					return t;
				}
				function b(r) {
					var e = w(r);
					return e >= 1 << (r - 1) ? e : e + (-1 << r) + 1;
				}
				var g = 0;
				var k,
					x = 0;
				function L(r, e, t, n, o) {
					var a = t % u,
						i = ((t / u) | 0) * r.v + n,
						s = a * r.h + o;
					e(r, r.blocks[i][s]);
				}
				function E(r, e, t) {
					var n = (t / r.blocksPerLine) | 0,
						o = t % r.blocksPerLine;
					e(r, r.blocks[n][o]);
				}
				var P,
					T,
					A,
					C,
					O,
					_,
					j = n.length;
				_ = h
					? 0 === a
						? 0 === s
							? function (r, e) {
									var t = y(r.huffmanTableDC),
										n = 0 === t ? 0 : b(t) << f;
									((r.pred += n), (e[0] = r.pred));
								}
							: function (r, e) {
									e[0] |= m() << f;
								}
						: 0 === s
							? function (r, e) {
									if (g > 0) g--;
									else
										for (var t = a, n = i; t <= n; ) {
											var o = y(r.huffmanTableAC),
												s = 15 & o,
												u = o >> 4;
											if (0 === s) {
												if (u < 15) {
													g = w(u) + (1 << u) - 1;
													break;
												}
												t += 16;
											} else ((e[c[(t += u)]] = b(s) * (1 << f)), t++);
										}
								}
							: function (r, e) {
									for (var t = a, n = i, o = 0; t <= n; ) {
										var s = c[t],
											u = e[s] < 0 ? -1 : 1;
										switch (x) {
											case 0:
												var h = y(r.huffmanTableAC),
													l = 15 & h;
												if (((o = h >> 4), 0 === l))
													o < 15
														? ((g = w(o) + (1 << o)), (x = 4))
														: ((o = 16), (x = 1));
												else {
													if (1 !== l)
														throw new Error('invalid ACn encoding');
													((k = b(l)), (x = o ? 2 : 3));
												}
												continue;
											case 1:
											case 2:
												e[s]
													? (e[s] += (m() << f) * u)
													: 0 === --o && (x = 2 === x ? 3 : 0);
												break;
											case 3:
												e[s]
													? (e[s] += (m() << f) * u)
													: ((e[s] = k << f), (x = 0));
												break;
											case 4:
												e[s] && (e[s] += (m() << f) * u);
										}
										t++;
									}
									4 === x && 0 === --g && (x = 0);
								}
					: function (r, e) {
							var t = y(r.huffmanTableDC),
								n = 0 === t ? 0 : b(t);
							((r.pred += n), (e[0] = r.pred));
							for (var o = 1; o < 64; ) {
								var a = y(r.huffmanTableAC),
									i = 15 & a,
									s = a >> 4;
								if (0 === i) {
									if (s < 15) break;
									o += 16;
								} else ((e[c[(o += s)]] = b(i)), o++);
							}
						};
				var I,
					S,
					G = 0;
				S = 1 === j ? n[0].blocksPerLine * n[0].blocksPerColumn : u * t.mcusPerColumn;
				for (var U = o || S; G < S; ) {
					for (T = 0; T < j; T++) n[T].pred = 0;
					if (((g = 0), 1 === j)) for (P = n[0], O = 0; O < U; O++) (E(P, _, G), G++);
					else
						for (O = 0; O < U; O++) {
							for (T = 0; T < j; T++) {
								var Z = (P = n[T]),
									D = Z.h,
									F = Z.v;
								for (A = 0; A < F; A++) for (C = 0; C < D; C++) L(P, _, G, A, C);
							}
							if (++G === S) break;
						}
					if (((p = 0), (I = (r[v] << 8) | r[v + 1]) < 65280))
						throw new Error('marker was not found');
					if (!(I >= 65488 && I <= 65495)) break;
					v += 2;
				}
				return v - l;
			}
			function b(r, e) {
				var t = [],
					n = e.blocksPerLine,
					o = e.blocksPerColumn,
					a = n << 3,
					i = new Int32Array(64),
					s = new Uint8Array(64);
				function c(r, t, n) {
					var o,
						a,
						i,
						s,
						c,
						y,
						w,
						b,
						g,
						k,
						x = e.quantizationTable,
						L = n;
					for (k = 0; k < 64; k++) L[k] = r[k] * x[k];
					for (k = 0; k < 8; ++k) {
						var E = 8 * k;
						0 !== L[1 + E] ||
						0 !== L[2 + E] ||
						0 !== L[3 + E] ||
						0 !== L[4 + E] ||
						0 !== L[5 + E] ||
						0 !== L[6 + E] ||
						0 !== L[7 + E]
							? ((o = (p * L[0 + E] + 128) >> 8),
								(a = (p * L[4 + E] + 128) >> 8),
								(i = L[2 + E]),
								(s = L[6 + E]),
								(c = (m * (L[1 + E] - L[7 + E]) + 128) >> 8),
								(b = (m * (L[1 + E] + L[7 + E]) + 128) >> 8),
								(y = L[3 + E] << 4),
								(w = L[5 + E] << 4),
								(g = (o - a + 1) >> 1),
								(o = (o + a + 1) >> 1),
								(a = g),
								(g = (i * d + s * v + 128) >> 8),
								(i = (i * v - s * d + 128) >> 8),
								(s = g),
								(g = (c - w + 1) >> 1),
								(c = (c + w + 1) >> 1),
								(w = g),
								(g = (b + y + 1) >> 1),
								(y = (b - y + 1) >> 1),
								(b = g),
								(g = (o - s + 1) >> 1),
								(o = (o + s + 1) >> 1),
								(s = g),
								(g = (a - i + 1) >> 1),
								(a = (a + i + 1) >> 1),
								(i = g),
								(g = (c * l + b * h + 2048) >> 12),
								(c = (c * h - b * l + 2048) >> 12),
								(b = g),
								(g = (y * u + w * f + 2048) >> 12),
								(y = (y * f - w * u + 2048) >> 12),
								(w = g),
								(L[0 + E] = o + b),
								(L[7 + E] = o - b),
								(L[1 + E] = a + w),
								(L[6 + E] = a - w),
								(L[2 + E] = i + y),
								(L[5 + E] = i - y),
								(L[3 + E] = s + c),
								(L[4 + E] = s - c))
							: ((g = (p * L[0 + E] + 512) >> 10),
								(L[0 + E] = g),
								(L[1 + E] = g),
								(L[2 + E] = g),
								(L[3 + E] = g),
								(L[4 + E] = g),
								(L[5 + E] = g),
								(L[6 + E] = g),
								(L[7 + E] = g));
					}
					for (k = 0; k < 8; ++k) {
						var P = k;
						0 !== L[8 + P] ||
						0 !== L[16 + P] ||
						0 !== L[24 + P] ||
						0 !== L[32 + P] ||
						0 !== L[40 + P] ||
						0 !== L[48 + P] ||
						0 !== L[56 + P]
							? ((o = (p * L[0 + P] + 2048) >> 12),
								(a = (p * L[32 + P] + 2048) >> 12),
								(i = L[16 + P]),
								(s = L[48 + P]),
								(c = (m * (L[8 + P] - L[56 + P]) + 2048) >> 12),
								(b = (m * (L[8 + P] + L[56 + P]) + 2048) >> 12),
								(y = L[24 + P]),
								(w = L[40 + P]),
								(g = (o - a + 1) >> 1),
								(o = (o + a + 1) >> 1),
								(a = g),
								(g = (i * d + s * v + 2048) >> 12),
								(i = (i * v - s * d + 2048) >> 12),
								(s = g),
								(g = (c - w + 1) >> 1),
								(c = (c + w + 1) >> 1),
								(w = g),
								(g = (b + y + 1) >> 1),
								(y = (b - y + 1) >> 1),
								(b = g),
								(g = (o - s + 1) >> 1),
								(o = (o + s + 1) >> 1),
								(s = g),
								(g = (a - i + 1) >> 1),
								(a = (a + i + 1) >> 1),
								(i = g),
								(g = (c * l + b * h + 2048) >> 12),
								(c = (c * h - b * l + 2048) >> 12),
								(b = g),
								(g = (y * u + w * f + 2048) >> 12),
								(y = (y * f - w * u + 2048) >> 12),
								(w = g),
								(L[0 + P] = o + b),
								(L[56 + P] = o - b),
								(L[8 + P] = a + w),
								(L[48 + P] = a - w),
								(L[16 + P] = i + y),
								(L[40 + P] = i - y),
								(L[24 + P] = s + c),
								(L[32 + P] = s - c))
							: ((g = (p * n[k + 0] + 8192) >> 14),
								(L[0 + P] = g),
								(L[8 + P] = g),
								(L[16 + P] = g),
								(L[24 + P] = g),
								(L[32 + P] = g),
								(L[40 + P] = g),
								(L[48 + P] = g),
								(L[56 + P] = g));
					}
					for (k = 0; k < 64; ++k) {
						var T = 128 + ((L[k] + 8) >> 4);
						t[k] = T < 0 ? 0 : T > 255 ? 255 : T;
					}
				}
				for (var y = 0; y < o; y++) {
					for (var w = y << 3, b = 0; b < 8; b++) t.push(new Uint8Array(a));
					for (var g = 0; g < n; g++) {
						c(e.blocks[y][g], s, i);
						for (var k = 0, x = g << 3, L = 0; L < 8; L++)
							for (var E = t[w + L], P = 0; P < 8; P++) E[x + P] = s[k++];
					}
				}
				return t;
			}
			var g = (function () {
					function r() {
						((0, a.Z)(this, r),
							(this.jfif = null),
							(this.adobe = null),
							(this.quantizationTables = []),
							(this.huffmanTablesAC = []),
							(this.huffmanTablesDC = []),
							this.resetFrames());
					}
					return (
						(0, i.Z)(r, [
							{
								key: 'resetFrames',
								value: function () {
									this.frames = [];
								}
							},
							{
								key: 'parse',
								value: function (r) {
									var e = 0;
									function t() {
										var t = (r[e] << 8) | r[e + 1];
										return ((e += 2), t);
									}
									function n() {
										var n = t(),
											o = r.subarray(e, e + n - 2);
										return ((e += o.length), o);
									}
									function o(r) {
										var e,
											t,
											n = 0,
											o = 0;
										for (t in r.components)
											r.components.hasOwnProperty(t) &&
												(n < (e = r.components[t]).h && (n = e.h),
												o < e.v && (o = e.v));
										var a = Math.ceil(r.samplesPerLine / 8 / n),
											i = Math.ceil(r.scanLines / 8 / o);
										for (t in r.components)
											if (r.components.hasOwnProperty(t)) {
												e = r.components[t];
												for (
													var s = Math.ceil(
															(Math.ceil(r.samplesPerLine / 8) *
																e.h) /
																n
														),
														c = Math.ceil(
															(Math.ceil(r.scanLines / 8) * e.v) / o
														),
														f = a * e.h,
														u = i * e.v,
														h = [],
														l = 0;
													l < u;
													l++
												) {
													for (var v = [], d = 0; d < f; d++)
														v.push(new Int32Array(64));
													h.push(v);
												}
												((e.blocksPerLine = s),
													(e.blocksPerColumn = c),
													(e.blocks = h));
											}
										((r.maxH = n),
											(r.maxV = o),
											(r.mcusPerLine = a),
											(r.mcusPerColumn = i));
									}
									var a = t();
									if (65496 !== a) throw new Error('SOI not found');
									for (a = t(); 65497 !== a; ) {
										switch (a) {
											case 65280:
												break;
											case 65504:
											case 65505:
											case 65506:
											case 65507:
											case 65508:
											case 65509:
											case 65510:
											case 65511:
											case 65512:
											case 65513:
											case 65514:
											case 65515:
											case 65516:
											case 65517:
											case 65518:
											case 65519:
											case 65534:
												var i = n();
												(65504 === a &&
													74 === i[0] &&
													70 === i[1] &&
													73 === i[2] &&
													70 === i[3] &&
													0 === i[4] &&
													(this.jfif = {
														version: { major: i[5], minor: i[6] },
														densityUnits: i[7],
														xDensity: (i[8] << 8) | i[9],
														yDensity: (i[10] << 8) | i[11],
														thumbWidth: i[12],
														thumbHeight: i[13],
														thumbData: i.subarray(
															14,
															14 + 3 * i[12] * i[13]
														)
													}),
													65518 === a &&
														65 === i[0] &&
														100 === i[1] &&
														111 === i[2] &&
														98 === i[3] &&
														101 === i[4] &&
														0 === i[5] &&
														(this.adobe = {
															version: i[6],
															flags0: (i[7] << 8) | i[8],
															flags1: (i[9] << 8) | i[10],
															transformCode: i[11]
														}));
												break;
											case 65499:
												for (var s = t() + e - 2; e < s; ) {
													var f = r[e++],
														u = new Int32Array(64);
													if (f >> 4 === 0)
														for (var h = 0; h < 64; h++) {
															u[c[h]] = r[e++];
														}
													else {
														if (f >> 4 !== 1)
															throw new Error(
																'DQT: invalid table spec'
															);
														for (var l = 0; l < 64; l++) {
															u[c[l]] = t();
														}
													}
													this.quantizationTables[15 & f] = u;
												}
												break;
											case 65472:
											case 65473:
											case 65474:
												t();
												for (
													var v = {
															extended: 65473 === a,
															progressive: 65474 === a,
															precision: r[e++],
															scanLines: t(),
															samplesPerLine: t(),
															components: {},
															componentsOrder: []
														},
														d = r[e++],
														p = void 0,
														m = 0;
													m < d;
													m++
												) {
													p = r[e];
													var b = r[e + 1] >> 4,
														g = 15 & r[e + 1],
														k = r[e + 2];
													(v.componentsOrder.push(p),
														(v.components[p] = {
															h: b,
															v: g,
															quantizationIdx: k
														}),
														(e += 3));
												}
												(o(v), this.frames.push(v));
												break;
											case 65476:
												for (var x = t(), L = 2; L < x; ) {
													for (
														var E = r[e++],
															P = new Uint8Array(16),
															T = 0,
															A = 0;
														A < 16;
														A++, e++
													)
														((P[A] = r[e]), (T += P[A]));
													for (
														var C = new Uint8Array(T), O = 0;
														O < T;
														O++, e++
													)
														C[O] = r[e];
													((L += 17 + T),
														E >> 4 === 0
															? (this.huffmanTablesDC[15 & E] = y(
																	P,
																	C
																))
															: (this.huffmanTablesAC[15 & E] = y(
																	P,
																	C
																)));
												}
												break;
											case 65501:
												(t(), (this.resetInterval = t()));
												break;
											case 65498:
												t();
												for (
													var _ = r[e++],
														j = [],
														I = this.frames[0],
														S = 0;
													S < _;
													S++
												) {
													var G = I.components[r[e++]],
														U = r[e++];
													((G.huffmanTableDC =
														this.huffmanTablesDC[U >> 4]),
														(G.huffmanTableAC =
															this.huffmanTablesAC[15 & U]),
														j.push(G));
												}
												var Z = r[e++],
													D = r[e++],
													F = r[e++],
													q = w(
														r,
														e,
														I,
														j,
														this.resetInterval,
														Z,
														D,
														F >> 4,
														15 & F
													);
												e += q;
												break;
											case 65535:
												255 !== r[e] && e--;
												break;
											default:
												if (
													255 === r[e - 3] &&
													r[e - 2] >= 192 &&
													r[e - 2] <= 254
												) {
													e -= 3;
													break;
												}
												throw new Error(
													'unknown JPEG marker '.concat(a.toString(16))
												);
										}
										a = t();
									}
								}
							},
							{
								key: 'getResult',
								value: function () {
									var r = this.frames;
									if (0 === this.frames.length)
										throw new Error('no frames were decoded');
									this.frames.length > 1 &&
										console.warn('more than one frame is not supported');
									for (var e = 0; e < this.frames.length; e++)
										for (
											var t = this.frames[e].components,
												n = 0,
												o = Object.keys(t);
											n < o.length;
											n++
										) {
											var a = o[n];
											((t[a].quantizationTable =
												this.quantizationTables[t[a].quantizationIdx]),
												delete t[a].quantizationIdx);
										}
									var i = r[0],
										s = i.components,
										c = i.componentsOrder,
										f = [],
										u = i.samplesPerLine,
										h = i.scanLines;
									for (e = 0; e < c.length; e++) {
										var l = s[c[e]];
										f.push({
											lines: b(0, l),
											scaleX: l.h / i.maxH,
											scaleY: l.v / i.maxV
										});
									}
									for (
										var v = new Uint8Array(u * h * f.length), d = 0, p = 0;
										p < h;
										++p
									)
										for (var m = 0; m < u; ++m)
											for (var y = 0; y < f.length; ++y) {
												var w = f[y];
												((v[d] =
													w.lines[0 | (p * w.scaleY)][
														0 | (m * w.scaleX)
													]),
													++d);
											}
									return v;
								}
							}
						]),
						r
					);
				})(),
				k = (function (r) {
					(0, n.Z)(t, r);
					var e = (0, o.Z)(t);
					function t(r) {
						var n;
						return (
							(0, a.Z)(this, t),
							((n = e.call(this)).reader = new g()),
							r.JPEGTables && n.reader.parse(r.JPEGTables),
							n
						);
					}
					return (
						(0, i.Z)(t, [
							{
								key: 'decodeBlock',
								value: function (r) {
									return (
										this.reader.resetFrames(),
										this.reader.parse(new Uint8Array(r)),
										this.reader.getResult().buffer
									);
								}
							}
						]),
						t
					);
				})(s.Z);
		}
	}
]);
