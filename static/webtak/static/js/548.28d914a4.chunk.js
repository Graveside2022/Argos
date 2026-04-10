/*! For license information please see 548.28d914a4.chunk.js.LICENSE.txt */
!(function () {
	'use strict';
	var t = {
			2548: function (t, e, n) {
				var o,
					r = n(1361),
					a = n(3028),
					i = n(4795),
					c = n(6666),
					u = n(9550),
					l = n(6042);
				!(function (t) {
					((t.NORMAL = 'normal'),
						(t.QUICK_PIC = 'quick-pic'),
						(t.ATTACHMENT_COT = 'attachment-cot'));
				})(o || (o = {}));
				var s = function (t) {
						return !!t && u.XML_ATTRIBUTE_KEY in t && 'Parameter' in t;
					},
					p = function (t) {
						return !!t && u.XML_ATTRIBUTE_KEY in t && 'Parameter' in t === !1;
					};
				function f(t) {
					var e = {},
						n = (0, u.fromXML)(t);
					if (n.event) {
						var o = n.event,
							r = new l.CotEventDetail({ xml: o.detail, xmlDetail: null }),
							a = o[u.XML_ATTRIBUTE_KEY],
							i = {};
						Object.keys(a).forEach(function (t) {
							['uid', 'type', 'time', 'start', 'how', 'stale'].some(function (e) {
								return e === t;
							}) && (i[t] = a[t]);
						});
						var c = o.point[u.XML_ATTRIBUTE_KEY],
							s = {};
						return (
							Object.keys(c).forEach(function (t) {
								['lat', 'lon', 'hae', 'ce', 'le'].some(function (e) {
									return e === t;
								}) && (s[t] = c[t]);
							}),
							(e.detail = r),
							(e.uid = i.uid),
							(e.type = i.type),
							(e.sendTime = parseInt(new Date(i.time).getTime().toString())),
							(e.startTime = parseInt(new Date(i.start).getTime().toString())),
							(e.staleTime = parseInt(new Date(i.stale).getTime().toString())),
							(e.how = i.how),
							(e.lat = s.lat),
							(e.lon = s.lon),
							(e.ce = parseInt(s.ce)),
							(e.le = parseInt(s.le)),
							(e.hae = parseInt(s.hae)),
							e
						);
					}
				}
				var m,
					d,
					v,
					h,
					y,
					g,
					b,
					k,
					w = n(2589),
					O = n(1601),
					T = n.n(O),
					E = 'wt-core';
				function P() {
					P = function () {
						return t;
					};
					var t = {},
						e = Object.prototype,
						n = e.hasOwnProperty,
						o = 'function' == typeof Symbol ? Symbol : {},
						r = o.iterator || '@@iterator',
						a = o.asyncIterator || '@@asyncIterator',
						i = o.toStringTag || '@@toStringTag';
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
					} catch (j) {
						c = function (t, e, n) {
							return (t[e] = n);
						};
					}
					function u(t, e, n, o) {
						var r = e && e.prototype instanceof p ? e : p,
							a = Object.create(r.prototype),
							i = new T(o || []);
						return (
							(a._invoke = (function (t, e, n) {
								var o = 'suspendedStart';
								return function (r, a) {
									if ('executing' === o)
										throw new Error('Generator is already running');
									if ('completed' === o) {
										if ('throw' === r) throw a;
										return x();
									}
									for (n.method = r, n.arg = a; ; ) {
										var i = n.delegate;
										if (i) {
											var c = k(i, n);
											if (c) {
												if (c === s) continue;
												return c;
											}
										}
										if ('next' === n.method) n.sent = n._sent = n.arg;
										else if ('throw' === n.method) {
											if ('suspendedStart' === o)
												throw ((o = 'completed'), n.arg);
											n.dispatchException(n.arg);
										} else 'return' === n.method && n.abrupt('return', n.arg);
										o = 'executing';
										var u = l(t, e, n);
										if ('normal' === u.type) {
											if (
												((o = n.done ? 'completed' : 'suspendedYield'),
												u.arg === s)
											)
												continue;
											return { value: u.arg, done: n.done };
										}
										'throw' === u.type &&
											((o = 'completed'),
											(n.method = 'throw'),
											(n.arg = u.arg));
									}
								};
							})(t, n, i)),
							a
						);
					}
					function l(t, e, n) {
						try {
							return { type: 'normal', arg: t.call(e, n) };
						} catch (j) {
							return { type: 'throw', arg: j };
						}
					}
					t.wrap = u;
					var s = {};
					function p() {}
					function f() {}
					function m() {}
					var d = {};
					c(d, r, function () {
						return this;
					});
					var v = Object.getPrototypeOf,
						h = v && v(v(E([])));
					h && h !== e && n.call(h, r) && (d = h);
					var y = (m.prototype = p.prototype = Object.create(d));
					function g(t) {
						['next', 'throw', 'return'].forEach(function (e) {
							c(t, e, function (t) {
								return this._invoke(e, t);
							});
						});
					}
					function b(t, e) {
						function o(r, a, i, c) {
							var u = l(t[r], t, a);
							if ('throw' !== u.type) {
								var s = u.arg,
									p = s.value;
								return p && 'object' == typeof p && n.call(p, '__await')
									? e.resolve(p.__await).then(
											function (t) {
												o('next', t, i, c);
											},
											function (t) {
												o('throw', t, i, c);
											}
										)
									: e.resolve(p).then(
											function (t) {
												((s.value = t), i(s));
											},
											function (t) {
												return o('throw', t, i, c);
											}
										);
							}
							c(u.arg);
						}
						var r;
						this._invoke = function (t, n) {
							function a() {
								return new e(function (e, r) {
									o(t, n, e, r);
								});
							}
							return (r = r ? r.then(a, a) : a());
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
									return s;
								((e.method = 'throw'),
									(e.arg = new TypeError(
										"The iterator does not provide a 'throw' method"
									)));
							}
							return s;
						}
						var o = l(n, t.iterator, e.arg);
						if ('throw' === o.type)
							return ((e.method = 'throw'), (e.arg = o.arg), (e.delegate = null), s);
						var r = o.arg;
						return r
							? r.done
								? ((e[t.resultName] = r.value),
									(e.next = t.nextLoc),
									'return' !== e.method &&
										((e.method = 'next'), (e.arg = void 0)),
									(e.delegate = null),
									s)
								: r
							: ((e.method = 'throw'),
								(e.arg = new TypeError('iterator result is not an object')),
								(e.delegate = null),
								s);
					}
					function w(t) {
						var e = { tryLoc: t[0] };
						(1 in t && (e.catchLoc = t[1]),
							2 in t && ((e.finallyLoc = t[2]), (e.afterLoc = t[3])),
							this.tryEntries.push(e));
					}
					function O(t) {
						var e = t.completion || {};
						((e.type = 'normal'), delete e.arg, (t.completion = e));
					}
					function T(t) {
						((this.tryEntries = [{ tryLoc: 'root' }]),
							t.forEach(w, this),
							this.reset(!0));
					}
					function E(t) {
						if (t) {
							var e = t[r];
							if (e) return e.call(t);
							if ('function' == typeof t.next) return t;
							if (!isNaN(t.length)) {
								var o = -1,
									a = function e() {
										for (; ++o < t.length; )
											if (n.call(t, o))
												return ((e.value = t[o]), (e.done = !1), e);
										return ((e.value = void 0), (e.done = !0), e);
									};
								return (a.next = a);
							}
						}
						return { next: x };
					}
					function x() {
						return { value: void 0, done: !0 };
					}
					return (
						(f.prototype = m),
						c(y, 'constructor', m),
						c(m, 'constructor', f),
						(f.displayName = c(m, i, 'GeneratorFunction')),
						(t.isGeneratorFunction = function (t) {
							var e = 'function' == typeof t && t.constructor;
							return (
								!!e &&
								(e === f || 'GeneratorFunction' === (e.displayName || e.name))
							);
						}),
						(t.mark = function (t) {
							return (
								Object.setPrototypeOf
									? Object.setPrototypeOf(t, m)
									: ((t.__proto__ = m), c(t, i, 'GeneratorFunction')),
								(t.prototype = Object.create(y)),
								t
							);
						}),
						(t.awrap = function (t) {
							return { __await: t };
						}),
						g(b.prototype),
						c(b.prototype, a, function () {
							return this;
						}),
						(t.AsyncIterator = b),
						(t.async = function (e, n, o, r, a) {
							void 0 === a && (a = Promise);
							var i = new b(u(e, n, o, r), a);
							return t.isGeneratorFunction(n)
								? i
								: i.next().then(function (t) {
										return t.done ? t.value : i.next();
									});
						}),
						g(y),
						c(y, i, 'Generator'),
						c(y, r, function () {
							return this;
						}),
						c(y, 'toString', function () {
							return '[object Generator]';
						}),
						(t.keys = function (t) {
							var e = [];
							for (var n in t) e.push(n);
							return (
								e.reverse(),
								function n() {
									for (; e.length; ) {
										var o = e.pop();
										if (o in t) return ((n.value = o), (n.done = !1), n);
									}
									return ((n.done = !0), n);
								}
							);
						}),
						(t.values = E),
						(T.prototype = {
							constructor: T,
							reset: function (t) {
								if (
									((this.prev = 0),
									(this.next = 0),
									(this.sent = this._sent = void 0),
									(this.done = !1),
									(this.delegate = null),
									(this.method = 'next'),
									(this.arg = void 0),
									this.tryEntries.forEach(O),
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
								function o(n, o) {
									return (
										(i.type = 'throw'),
										(i.arg = t),
										(e.next = n),
										o && ((e.method = 'next'), (e.arg = void 0)),
										!!o
									);
								}
								for (var r = this.tryEntries.length - 1; r >= 0; --r) {
									var a = this.tryEntries[r],
										i = a.completion;
									if ('root' === a.tryLoc) return o('end');
									if (a.tryLoc <= this.prev) {
										var c = n.call(a, 'catchLoc'),
											u = n.call(a, 'finallyLoc');
										if (c && u) {
											if (this.prev < a.catchLoc) return o(a.catchLoc, !0);
											if (this.prev < a.finallyLoc) return o(a.finallyLoc);
										} else if (c) {
											if (this.prev < a.catchLoc) return o(a.catchLoc, !0);
										} else {
											if (!u)
												throw new Error(
													'try statement without catch or finally'
												);
											if (this.prev < a.finallyLoc) return o(a.finallyLoc);
										}
									}
								}
							},
							abrupt: function (t, e) {
								for (var o = this.tryEntries.length - 1; o >= 0; --o) {
									var r = this.tryEntries[o];
									if (
										r.tryLoc <= this.prev &&
										n.call(r, 'finallyLoc') &&
										this.prev < r.finallyLoc
									) {
										var a = r;
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
										? ((this.method = 'next'), (this.next = a.finallyLoc), s)
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
									s
								);
							},
							finish: function (t) {
								for (var e = this.tryEntries.length - 1; e >= 0; --e) {
									var n = this.tryEntries[e];
									if (n.finallyLoc === t)
										return (this.complete(n.completion, n.afterLoc), O(n), s);
								}
							},
							catch: function (t) {
								for (var e = this.tryEntries.length - 1; e >= 0; --e) {
									var n = this.tryEntries[e];
									if (n.tryLoc === t) {
										var o = n.completion;
										if ('throw' === o.type) {
											var r = o.arg;
											O(n);
										}
										return r;
									}
								}
								throw new Error('illegal catch attempt');
							},
							delegateYield: function (t, e, n) {
								return (
									(this.delegate = { iterator: E(t), resultName: e, nextLoc: n }),
									'next' === this.method && (this.arg = void 0),
									s
								);
							}
						}),
						t
					);
				}
				function x() {
					return j.apply(this, arguments);
				}
				function j() {
					return (j = (0, i.Z)(
						P().mark(function t() {
							return P().wrap(function (t) {
								for (;;)
									switch ((t.prev = t.next)) {
										case 0:
											return ((t.next = 2), (0, w.X3)(E));
										case 2:
											k = t.sent;
										case 3:
										case 'end':
											return t.stop();
									}
							}, t);
						})
					)).apply(this, arguments);
				}
				function _(t) {
					return S.apply(this, arguments);
				}
				function S() {
					return (
						(S = (0, i.Z)(
							P().mark(function t(e) {
								var n, o, r, a, c, u, l, s, p;
								return P().wrap(function (t) {
									for (;;)
										switch ((t.prev = t.next)) {
											case 0:
												return (
													(o = (n = e).fileBlob),
													(r = n.fileName),
													(a = new (T())()),
													(c = new File([o], r)),
													(t.next = 5),
													a.loadAsync(c, {
														base64: !1,
														createFolders: !0
													})
												);
											case 5:
												((u = t.sent),
													(l = Object.keys(u.files)
														.filter(function (t) {
															var e = u.file(t);
															return !!e && !e.dir;
														})
														.map(
															(function () {
																var t = (0, i.Z)(
																	P().mark(function t(e) {
																		var n;
																		return P().wrap(function (
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
																							u
																								.file(
																									e
																								)
																								.async(
																									'blob'
																								)
																						);
																					case 2:
																						return (
																							(n =
																								t.sent),
																							t.abrupt(
																								'return',
																								{
																									file: e,
																									blob: n
																								}
																							)
																						);
																					case 4:
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
														)),
													(s = []),
													l.forEach(
														(function () {
															var t = (0, i.Z)(
																P().mark(function t(e) {
																	var n;
																	return P().wrap(function (t) {
																		for (;;)
																			switch (
																				(t.prev = t.next)
																			) {
																				case 0:
																					return (
																						(t.next = 2),
																						e
																					);
																				case 2:
																					((n = t.sent),
																						s.push(n));
																				case 4:
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
													),
													(p = { mode: y.UnzipFile, payload: s }),
													postMessage(p));
											case 11:
											case 'end':
												return t.stop();
										}
								}, t);
							})
						)),
						S.apply(this, arguments)
					);
				}
				function L() {
					return C.apply(this, arguments);
				}
				function C() {
					return (C = (0, i.Z)(
						P().mark(function t() {
							var e, n, o;
							return P().wrap(function (t) {
								for (;;)
									switch ((t.prev = t.next)) {
										case 0:
											if (k) {
												t.next = 3;
												break;
											}
											return ((t.next = 3), x());
										case 3:
											return (
												(e = k.transaction('data-packages', 'readonly')),
												(t.next = 6),
												k.getAll('data-packages')
											);
										case 6:
											((n = t.sent),
												e.done,
												(o = { mode: y.GetAllDataPackages, payload: n }),
												postMessage(o));
										case 10:
										case 'end':
											return t.stop();
									}
							}, t);
						})
					)).apply(this, arguments);
				}
				function M(t) {
					var e = isNaN(t.le) ? 999999 : t.le,
						n = isNaN(t.hae) ? 99999 : t.hae,
						o = isNaN(t.ce) ? 99999 : t.ce;
					return new l.CotEvent(
						(0, a.Z)(
							(0, a.Z)({}, t),
							{},
							{
								detail: t.detail
									? (0, u.safeConstruct)(l.CotEventDetail, t.detail)
									: null,
								le: e,
								hae: n,
								ce: o
							}
						)
					);
				}
				function D(t) {
					var e = [],
						n = t.MissionPackageManifest.Contents.Content;
					if (Array.isArray(n))
						n.forEach(function (t) {
							if (s(t)) {
								if ('cot' !== t[u.XML_ATTRIBUTE_KEY].zipEntry.split('.').pop()) {
									var n = t[u.XML_ATTRIBUTE_KEY].zipEntry,
										o = {
											fileType: t[u.XML_ATTRIBUTE_KEY].zipEntry
												.split('.')
												.pop(),
											uid: t.Parameter[u.XML_ATTRIBUTE_KEY].value,
											filePath: n,
											fileName: n.split('/')[1]
										};
									e.push(o);
								}
							} else if (p(t)) {
								var r = t[u.XML_ATTRIBUTE_KEY].zipEntry,
									a = {
										fileType: t[u.XML_ATTRIBUTE_KEY].zipEntry.split('.').pop(),
										uid: (0, u.uuid)(),
										filePath: r,
										fileName: r.split('/')[1]
									};
								e.push(a);
							}
						});
					else if (s(n)) {
						if ('cot' !== n[u.XML_ATTRIBUTE_KEY].zipEntry.split('.').pop()) {
							var o = n[u.XML_ATTRIBUTE_KEY].zipEntry,
								r = {
									fileType: n[u.XML_ATTRIBUTE_KEY].zipEntry.split('.').pop(),
									uid: n.Parameter[u.XML_ATTRIBUTE_KEY].value,
									filePath: o,
									fileName: o.split('/')[1]
								};
							e.push(r);
						}
					} else if (p(n)) {
						var a = n[u.XML_ATTRIBUTE_KEY].zipEntry,
							i = {
								fileType: n[u.XML_ATTRIBUTE_KEY].zipEntry.split('.').pop(),
								uid: (0, u.uuid)(),
								filePath: a,
								fileName: a.split('/')[1]
							};
						e.push(i);
					}
					return e;
				}
				function N(t, e) {
					return I.apply(this, arguments);
				}
				function I() {
					return (I = (0, i.Z)(
						P().mark(function t(e, n) {
							var o, r;
							return P().wrap(function (t) {
								for (;;)
									switch ((t.prev = t.next)) {
										case 0:
											return (
												(t.next = 2),
												fetch(''.concat(n, '/content?hash=').concat(e))
											);
										case 2:
											return ((o = t.sent), (t.next = 5), o.blob());
										case 5:
											return ((r = t.sent), t.abrupt('return', r));
										case 7:
										case 'end':
											return t.stop();
									}
							}, t);
						})
					)).apply(this, arguments);
				}
				function A(t, e) {
					return F.apply(this, arguments);
				}
				function F() {
					return (F = (0, i.Z)(
						P().mark(function t(e, n) {
							var o, r, a, i, c, l, p, m;
							return P().wrap(function (t) {
								for (;;)
									switch ((t.prev = t.next)) {
										case 0:
											((o = []),
												(r = n.MissionPackageManifest.Contents.Content),
												Array.isArray(r)
													? r.forEach(function (t) {
															if (
																s(t) &&
																'cot' ===
																	t[u.XML_ATTRIBUTE_KEY].zipEntry
																		.split('.')
																		.pop()
															)
																return o.push(
																	t[u.XML_ATTRIBUTE_KEY].zipEntry
																);
														})
													: s(r) &&
														'cot' ===
															r[u.XML_ATTRIBUTE_KEY].zipEntry
																.split('.')
																.pop() &&
														o.push(r[u.XML_ATTRIBUTE_KEY].zipEntry),
												(a = []),
												(i = 0),
												(c = o));
										case 5:
											if (!(i < c.length)) {
												t.next = 15;
												break;
											}
											if (((l = c[i]), !e.file(l))) {
												t.next = 12;
												break;
											}
											return ((t.next = 10), e.file(l).async('text'));
										case 10:
											((p = t.sent), a.push(p));
										case 12:
											(i++, (t.next = 5));
											break;
										case 15:
											return (
												(m = []),
												a.forEach(function (t) {
													var e = f(t);
													e && m.push(e);
												}),
												t.abrupt('return', m)
											);
										case 18:
										case 'end':
											return t.stop();
									}
							}, t);
						})
					)).apply(this, arguments);
				}
				function R(t) {
					return G.apply(this, arguments);
				}
				function G() {
					return (G = (0, i.Z)(
						P().mark(function t(e) {
							var n, o;
							return P().wrap(function (t) {
								for (;;)
									switch ((t.prev = t.next)) {
										case 0:
											if (!e.file('MANIFEST/manifest.xml')) {
												t.next = 5;
												break;
											}
											return (
												(t.next = 3),
												e.file('MANIFEST/manifest.xml').async('text')
											);
										case 3:
											((o = t.sent), (n = (0, u.fromXML)(o)));
										case 5:
											return t.abrupt('return', n);
										case 6:
										case 'end':
											return t.stop();
									}
							}, t);
						})
					)).apply(this, arguments);
				}
				function U(t, e) {
					return B.apply(this, arguments);
				}
				function B() {
					return (B = (0, i.Z)(
						P().mark(function t(e, n) {
							var o, i, c, u, l;
							return P().wrap(
								function (t) {
									for (;;)
										switch ((t.prev = t.next)) {
											case 0:
												if (0 !== n.length) {
													t.next = 2;
													break;
												}
												return t.abrupt('return', []);
											case 2:
												((o = []), (i = (0, r.Z)(n)), (t.prev = 4), i.s());
											case 6:
												if ((c = i.n()).done) {
													t.next = 15;
													break;
												}
												if (((u = c.value), !e.file(u.filePath))) {
													t.next = 13;
													break;
												}
												return (
													(t.next = 11),
													e.file(u.filePath).async('blob')
												);
											case 11:
												((l = t.sent),
													o.push(
														(0, a.Z)(
															(0, a.Z)({ blob: l }, u),
															{},
															{ fileSizeInBytes: l.size }
														)
													));
											case 13:
												t.next = 6;
												break;
											case 15:
												t.next = 20;
												break;
											case 17:
												((t.prev = 17), (t.t0 = t.catch(4)), i.e(t.t0));
											case 20:
												return ((t.prev = 20), i.f(), t.finish(20));
											case 23:
												return t.abrupt('return', o);
											case 24:
											case 'end':
												return t.stop();
										}
								},
								t,
								null,
								[[4, 17, 20, 23]]
							);
						})
					)).apply(this, arguments);
				}
				function V(t) {
					return X.apply(this, arguments);
				}
				function X() {
					return (X = (0, i.Z)(
						P().mark(function t(e) {
							var n, o, r, a, i, c, s, p, f, m, d, v, h, g, b, k, w, O, E;
							return P().wrap(function (t) {
								for (;;)
									switch ((t.prev = t.next)) {
										case 0:
											if (
												((o = (n = e).event),
												(r = n.syncUrl),
												(a = {
													mode: y.ProcessNewDataPackage,
													payload: void 0
												}),
												(i = M(o)).detail)
											) {
												t.next = 7;
												break;
											}
											return (
												(a.payload = {
													error: !0,
													errorDetails: {
														type: 'NoCot',
														detail: 'no cot details'
													}
												}),
												postMessage(a),
												t.abrupt('return')
											);
										case 7:
											if (!i.detail) {
												t.next = 40;
												break;
											}
											if (
												((c = i.detail.xml),
												(s = c.fileshare[u.XML_ATTRIBUTE_KEY].sha256),
												(p =
													c.fileshare[u.XML_ATTRIBUTE_KEY]
														.senderCallsign),
												(f = c.fileshare[u.XML_ATTRIBUTE_KEY].filename),
												(m = c.fileshare[u.XML_ATTRIBUTE_KEY].sizeInBytes),
												!(m / Math.pow(2, 20) > 15))
											) {
												t.next = 18;
												break;
											}
											return (
												(a.payload = {
													error: !0,
													errorDetails: {
														sizeInBytes: m,
														sha256Hash: s,
														senderCallsign: p,
														fileName: f
													}
												}),
												postMessage(a),
												t.abrupt('return')
											);
										case 18:
											return ((t.next = 20), N(s, r));
										case 20:
											return (
												(d = t.sent),
												(v = new File([d], f)),
												(t.next = 24),
												T().loadAsync(v, { base64: !1, createFolders: !0 })
											);
										case 24:
											return ((h = t.sent), (t.next = 27), R(h));
										case 27:
											return (
												(g = t.sent),
												(b = D(g)),
												(t.next = 31),
												A(h, g)
											);
										case 31:
											return (
												(k = t.sent),
												(w = k.map(function (t) {
													return new l.CotEvent(t).toJS();
												})),
												(t.next = 35),
												U(h, b)
											);
										case 35:
											((O = t.sent),
												(E = {
													uid: s || (0, u.uuid)(),
													manifest: g,
													name: v.name.slice(0, -4),
													sender: p,
													size: v.size,
													enabled: !1,
													cotsEvents: w,
													attachments: O
												}),
												(a.payload = E),
												postMessage(a),
												K(E));
										case 40:
										case 'end':
											return t.stop();
									}
							}, t);
						})
					)).apply(this, arguments);
				}
				function Y(t) {
					var e = t,
						n = (0, a.Z)((0, a.Z)({}, e), {}, { enabled: !e.enabled }),
						o = { mode: y.ToggleDataPackageEnabled, payload: n };
					(postMessage(o), K(e));
				}
				function K(t) {
					return Z.apply(this, arguments);
				}
				function Z() {
					return (Z = (0, i.Z)(
						P().mark(function t(e) {
							var n;
							return P().wrap(function (t) {
								for (;;)
									switch ((t.prev = t.next)) {
										case 0:
											if (k) {
												t.next = 3;
												break;
											}
											return ((t.next = 3), x());
										case 3:
											return (
												(n = k.transaction(['data-packages'], 'readwrite')),
												(t.next = 6),
												k.put('data-packages', e)
											);
										case 6:
											n.done;
										case 7:
										case 'end':
											return t.stop();
									}
							}, t);
						})
					)).apply(this, arguments);
				}
				function z(t) {
					return q.apply(this, arguments);
				}
				function q() {
					return (q = (0, i.Z)(
						P().mark(function t(e) {
							var n, o, r;
							return P().wrap(function (t) {
								for (;;)
									switch ((t.prev = t.next)) {
										case 0:
											if (((n = e), k)) {
												t.next = 4;
												break;
											}
											return ((t.next = 4), x());
										case 4:
											return (
												(o = k.transaction(['data-packages'], 'readwrite')),
												(t.next = 7),
												k.put('data-packages', n)
											);
										case 7:
											(o.done,
												(r = { mode: y.UpdateDataPackage, payload: n }),
												postMessage(r));
										case 10:
										case 'end':
											return t.stop();
									}
							}, t);
						})
					)).apply(this, arguments);
				}
				function J(t) {
					return H.apply(this, arguments);
				}
				function H() {
					return (H = (0, i.Z)(
						P().mark(function t(e) {
							var n, o, a, i, c;
							return P().wrap(
								function (t) {
									for (;;)
										switch ((t.prev = t.next)) {
											case 0:
												if (((n = [].concat(e)), k)) {
													t.next = 5;
													break;
												}
												return ((t.next = 5), x());
											case 5:
												if (
													((o = k.transaction(
														['data-packages'],
														'readwrite'
													)),
													!(n.length <= 1))
												) {
													t.next = 10;
													break;
												}
												return (
													(t.next = 9),
													k.delete('data-packages', n[0])
												);
											case 9:
												return t.abrupt('return');
											case 10:
												((a = (0, r.Z)(n)), (t.prev = 11), a.s());
											case 13:
												if ((i = a.n()).done) {
													t.next = 19;
													break;
												}
												return (
													(c = i.value),
													(t.next = 17),
													k.delete('data-packages', c)
												);
											case 17:
												t.next = 13;
												break;
											case 19:
												t.next = 24;
												break;
											case 21:
												((t.prev = 21), (t.t0 = t.catch(11)), a.e(t.t0));
											case 24:
												return ((t.prev = 24), a.f(), t.finish(24));
											case 27:
												o.done;
											case 28:
											case 'end':
												return t.stop();
										}
								},
								t,
								null,
								[[11, 21, 24, 27]]
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
				})(m || (m = {})),
					(function (t) {
						((t[(t.GetAllEvents = 0)] = 'GetAllEvents'),
							(t[(t.RemoveEvents = 1)] = 'RemoveEvents'),
							(t[(t.SaveEvents = 2)] = 'SaveEvents'));
					})(d || (d = {})),
					(function (t) {
						((t[(t.Connect = 0)] = 'Connect'),
							(t[(t.Disconnect = 1)] = 'Disconnect'),
							(t[(t.SetSocketUrl = 2)] = 'SetSocketUrl'),
							(t[(t.OnSocketConnect = 3)] = 'OnSocketConnect'),
							(t[(t.OnSocketDisconnect = 4)] = 'OnSocketDisconnect'),
							(t[(t.OnSocketError = 5)] = 'OnSocketError'),
							(t[(t.OnSocketMessage = 6)] = 'OnSocketMessage'),
							(t[(t.SendMessage = 7)] = 'SendMessage'));
					})(v || (v = {})),
					(function (t) {
						((t[(t.DeleteMessages = 0)] = 'DeleteMessages'),
							(t[(t.GetAllMessages = 1)] = 'GetAllMessages'),
							(t[(t.SaveMessages = 2)] = 'SaveMessages'));
					})(h || (h = {})),
					(function (t) {
						((t[(t.UnzipFile = 0)] = 'UnzipFile'),
							(t[(t.GetAllDataPackages = 1)] = 'GetAllDataPackages'),
							(t[(t.ProcessNewDataPackage = 2)] = 'ProcessNewDataPackage'),
							(t[(t.ToggleDataPackageEnabled = 3)] = 'ToggleDataPackageEnabled'),
							(t[(t.UpdateDataPackage = 4)] = 'UpdateDataPackage'),
							(t[(t.DeleteDataPackage = 5)] = 'DeleteDataPackage'));
					})(y || (y = {})),
					(function (t) {
						((t[(t.GetWkt = 0)] = 'GetWkt'),
							(t[(t.LoadTiff = 1)] = 'LoadTiff'),
							(t[(t.LoadItems = 2)] = 'LoadItems'));
					})(g || (g = {})),
					(function (t) {
						((t[(t.AddFile = 0)] = 'AddFile'),
							(t[(t.GetAllFiles = 1)] = 'GetAllFiles'),
							(t[(t.GetFile = 2)] = 'GetFile'),
							(t[(t.RemoveFile = 3)] = 'RemoveFile'),
							(t[(t.UpdateFile = 4)] = 'UpdateFile'));
					})(b || (b = {})),
					(onmessage = function (t) {
						var e,
							n = t.data,
							o = n.mode,
							r = n.payload,
							a = ((e = {}),
							(0, c.Z)(e, y.UnzipFile, _),
							(0, c.Z)(e, y.GetAllDataPackages, L),
							(0, c.Z)(e, y.ProcessNewDataPackage, V),
							(0, c.Z)(e, y.ToggleDataPackageEnabled, Y),
							(0, c.Z)(e, y.UpdateDataPackage, z),
							(0, c.Z)(e, y.DeleteDataPackage, J),
							e)[o];
						a && a(r);
					}));
			},
			6042: function (t, e, n) {
				var o =
						(this && this.__createBinding) ||
						(Object.create
							? function (t, e, n, o) {
									(void 0 === o && (o = n),
										Object.defineProperty(t, o, {
											enumerable: !0,
											get: function () {
												return e[n];
											}
										}));
								}
							: function (t, e, n, o) {
									(void 0 === o && (o = n), (t[o] = e[n]));
								}),
					r =
						(this && this.__exportStar) ||
						function (t, e) {
							for (var n in t)
								'default' === n ||
									Object.prototype.hasOwnProperty.call(e, n) ||
									o(e, t, n);
						};
				(Object.defineProperty(e, '__esModule', { value: !0 }),
					r(n(2797), e),
					r(n(2664), e),
					r(n(5219), e));
			},
			5219: function (t, e, n) {
				(Object.defineProperty(e, '__esModule', { value: !0 }), (e.MessageTypes = void 0));
				n(9550);
				!(function (t) {
					((t.CHAT_MESSAGE = 'ChatMessage'),
						(t.CONTROL_MESSAGE = 'ControlMessage'),
						(t.SITUATIONAL_AWARENESS = 'SituationAwarenessMessage'),
						(t.MISSION_CHANGE = 'MissionChange'));
				})(e.MessageTypes || (e.MessageTypes = {}));
			},
			8416: function (t, e, n) {
				var o = n(1068).default,
					r = n(85).default,
					a = n(5198).default,
					i = n(3772).default,
					c = n(2588).default,
					u = n(270).default,
					l = n(4564).default,
					s =
						(this && this.__importDefault) ||
						function (t) {
							return t && t.__esModule ? t : { default: t };
						};
				Object.defineProperty(e, '__esModule', { value: !0 });
				var p = n(515),
					f = s(n(6635)),
					m = s(n(6067)),
					d = n(9550),
					v = d.isNullable(d.isString),
					h = d.isNullable(d.isInstanceOf(m.default)),
					y = {
						access: null,
						ce: 999999,
						detail: null,
						hae: 999999,
						how: 'h-g-i-g-o',
						le: 999999,
						lat: 0,
						lon: 0,
						opex: null,
						qos: null,
						sendTime: Date.now(),
						staleTime: Date.now(),
						startTime: Date.now(),
						type: 'a-f-G-U-C-I',
						uid: d.uuid()
					},
					g = {
						access: [v, 'nullable string'],
						ce: [d.isNumber, 'number'],
						detail: [h, 'nullable EventDetail instance'],
						hae: [d.isNumber, 'number'],
						how: [d.isString, 'string'],
						le: [d.isNumber, 'number'],
						lat: [d.pass, 'latitude'],
						lon: [d.pass, 'longitude'],
						opex: [v, 'nullable string'],
						qos: [v, 'nullable string'],
						sendTime: [d.isNumber, 'number'],
						staleTime: [d.isNumber, 'number'],
						startTime: [d.isNumber, 'number'],
						type: [d.isNonEmptyString, 'non-empty string'],
						uid: [d.isNonEmptyString, 'non-empty string']
					},
					b = (function (t) {
						u(n, t);
						var e = l(n);
						function n() {
							var t =
								arguments.length > 0 && void 0 !== arguments[0] ? arguments[0] : {};
							return (
								r(this, n),
								Object.entries(t).forEach(function (t) {
									var e = o(t, 2),
										n = e[0],
										r = e[1],
										a = o(g[n], 2),
										i = a[0],
										c = a[1];
									if (!i(r))
										throw new f.default(
											'Event constructor',
											'props.'.concat(n),
											c
										);
								}),
								e.call(this, t)
							);
						}
						return (
							a(n, [
								{
									key: 'set',
									value: function (t, e) {
										var o = g[t];
										if (!o)
											throw new Error(
												'Event.set Cannot set unknown key "'.concat(t, '".')
											);
										if (!o[0](e)) throw new f.default('Event.set', t, o[1]);
										return i(c(n.prototype), 'set', this).call(this, t, e);
									}
								}
							]),
							n
						);
					})(p.Record(y));
				e.default = b;
			},
			4927: function (t, e, n) {
				var o =
					(this && this.__importDefault) ||
					function (t) {
						return t && t.__esModule ? t : { default: t };
					};
				Object.defineProperty(e, '__esModule', { value: !0 });
				var r = o(n(6771)),
					a = n(9550);
				e.default = r.default(
					{ callsign: '', endpoint: '' },
					{ callsign: a.isString, endpoint: a.isOptional(a.isString) },
					'Contact'
				);
			},
			6067: function (t, e, n) {
				var o = n(1260).default,
					r = n(85).default,
					a = n(5198).default,
					i = n(3772).default,
					c = n(2588).default,
					u = n(270).default,
					l = n(4564).default,
					s =
						(this && this.__importDefault) ||
						function (t) {
							return t && t.__esModule ? t : { default: t };
						};
				Object.defineProperty(e, '__esModule', { value: !0 });
				var p = n(515),
					f = n(9550),
					m = s(n(4927)),
					d = s(n(490)),
					v = s(n(8308)),
					h = s(n(3501)),
					y = s(n(7951)),
					g = s(n(5974)),
					b = n(9550),
					k = n(2797),
					w = {
						contact: null,
						group: null,
						precisionLocation: null,
						status: null,
						takv: null,
						track: null,
						xml: null,
						xmlDetail: null
					},
					O = (function (t) {
						u(n, t);
						var e = l(n);
						function n(t) {
							if ((r(this, n), !b.isNull(t.xmlDetail)))
								throw new Error(
									'EventDetail.constructor props.xmlDetail must be null. Assign XML by provided a parsable object structure as the "xml" prop.'
								);
							return e.call(this, n.convertProps(t));
						}
						return (
							a(
								n,
								[
									{
										key: 'xml',
										get: function () {
											var t = this.get('xml');
											return t || null;
										}
									},
									{
										key: 'get',
										value: function (t) {
											if ('xml' === t) {
												var e = i(c(n.prototype), 'get', this).call(
													this,
													'xml'
												);
												return e || null;
											}
											return i(c(n.prototype), 'get', this).call(this, t);
										}
									},
									{
										key: 'set',
										value: function (t, e) {
											if ('undefined' === typeof w[t])
												throw new Error(
													'EventDetail.set Cannot set unknown key '.concat(
														t,
														'.'
													)
												);
											var r = n.convertProps(o({}, t, e))[t];
											return i(c(n.prototype), 'set', this).call(this, t, r);
										}
									},
									{
										key: 'setIn',
										value: function () {
											throw new Error(
												'EventDetail.setIn Cannot deeply update EventDetail records. Create a new instance or call "set".'
											);
										}
									},
									{
										key: 'merge',
										value: function () {
											throw new Error(
												'EventDetail.merge Cannot merge EventDetail records. Create a new instance or call "set".'
											);
										}
									},
									{
										key: 'update',
										value: function (t, e) {
											if ('function' !== typeof e)
												throw new Error(
													'EventDetail.update Updater argument must be a function.'
												);
											var n = e(this[t]);
											return this.set(t, n);
										}
									},
									{
										key: 'updateIn',
										value: function () {
											throw new Error(
												'EventDetail.updateIn Cannot deeply update EventDetail records. Create a new instance or call "set".'
											);
										}
									},
									{
										key: 'getContact',
										value: function () {
											if (this.contact)
												return {
													callsign: this.contact.callsign,
													endpoint: this.contact.endpoint
												};
											var t = this.getXMLAttributes('contact');
											return k.isContact(t) ? t : null;
										}
									},
									{
										key: 'setCallsign',
										value: function (t) {
											return this.contact
												? this.update('contact', function (e) {
														return e
															? e.set('callsign', t)
															: new m.default({ callsign: t });
													})
												: this;
										}
									},
									{
										key: 'getGroup',
										value: function () {
											if (this.group)
												return {
													name: this.group.name,
													role: this.group.role
												};
											var t = this.getXMLAttributes('group');
											return k.isGroup(t) ? t : null;
										}
									},
									{ key: 'getStatus', value: function () {} },
									{
										key: 'getTakv',
										value: function () {
											return this.takv
												? {
														device: this.takv.device,
														os: this.takv.os,
														platform: this.takv.platform,
														version: this.takv.version
													}
												: this.getXMLAttributes('group');
										}
									},
									{
										key: 'getRemarks',
										value: function () {
											return (
												this.getIn(['xml', 'remarks', f.XML_TEXT_KEY]) || ''
											);
										}
									},
									{
										key: 'setRemarks',
										value: function (t) {
											return i(c(n.prototype), 'setIn', this).call(
												this,
												['xml', 'remarks'],
												o({}, f.XML_TEXT_KEY, t)
											);
										}
									},
									{ key: 'getTrack', value: function () {} },
									{
										key: 'getXMLAttributes',
										value: function (t) {
											return (
												this.getIn(['xml', t, f.XML_ATTRIBUTE_KEY]) || null
											);
										}
									}
								],
								[
									{
										key: 'convertProps',
										value: function (t) {
											return {
												contact: t.contact
													? f.safeConstruct(m.default, t.contact)
													: null,
												group: t.group
													? f.safeConstruct(d.default, t.group)
													: null,
												precisionLocation: t.precisionLocation
													? f.safeConstruct(
															v.default,
															t.precisionLocation
														)
													: null,
												status: t.status
													? f.safeConstruct(h.default, t.status)
													: null,
												takv: t.takv
													? f.safeConstruct(y.default, t.takv)
													: null,
												track: t.track
													? f.safeConstruct(g.default, t.track)
													: null,
												xml: t.xml ? f.clone(t.xml) : null,
												xmlDetail: null
											};
										}
									}
								]
							),
							n
						);
					})(p.Record(w));
				e.default = O;
			},
			490: function (t, e, n) {
				var o =
					(this && this.__importDefault) ||
					function (t) {
						return t && t.__esModule ? t : { default: t };
					};
				Object.defineProperty(e, '__esModule', { value: !0 });
				var r = o(n(6771)),
					a = n(9550);
				e.default = r.default(
					{ name: '', role: '' },
					{ name: a.isString, role: a.isString },
					'Group'
				);
			},
			8308: function (t, e, n) {
				var o =
					(this && this.__importDefault) ||
					function (t) {
						return t && t.__esModule ? t : { default: t };
					};
				Object.defineProperty(e, '__esModule', { value: !0 });
				var r = o(n(6771)),
					a = n(9550);
				e.default = r.default(
					{ altsrc: '', geopointsrc: '' },
					{ altsrc: a.isString, geopointsrc: a.isString },
					'PrecisionLocation'
				);
			},
			3501: function (t, e, n) {
				var o =
					(this && this.__importDefault) ||
					function (t) {
						return t && t.__esModule ? t : { default: t };
					};
				Object.defineProperty(e, '__esModule', { value: !0 });
				var r = o(n(6771)),
					a = n(9550);
				e.default = r.default({ battery: 0 }, { battery: a.isNumber }, 'Status');
			},
			7951: function (t, e, n) {
				var o =
					(this && this.__importDefault) ||
					function (t) {
						return t && t.__esModule ? t : { default: t };
					};
				Object.defineProperty(e, '__esModule', { value: !0 });
				var r = o(n(6771)),
					a = n(9550);
				e.default = r.default(
					{ device: '', os: '', platform: '', version: '' },
					{
						device: a.isString,
						os: a.isString,
						platform: a.isString,
						version: a.isString
					},
					'Takv'
				);
			},
			5974: function (t, e, n) {
				var o =
					(this && this.__importDefault) ||
					function (t) {
						return t && t.__esModule ? t : { default: t };
					};
				Object.defineProperty(e, '__esModule', { value: !0 });
				var r = o(n(6771)),
					a = n(9550);
				e.default = r.default(
					{ course: 0, speed: 0 },
					{ course: a.isOptional(a.isNumber), speed: a.isOptional(a.isNumber) },
					'Track'
				);
			},
			2664: function (t, e, n) {
				var o =
						(this && this.__createBinding) ||
						(Object.create
							? function (t, e, n, o) {
									(void 0 === o && (o = n),
										Object.defineProperty(t, o, {
											enumerable: !0,
											get: function () {
												return e[n];
											}
										}));
								}
							: function (t, e, n, o) {
									(void 0 === o && (o = n), (t[o] = e[n]));
								}),
					r =
						(this && this.__exportStar) ||
						function (t, e) {
							for (var n in t)
								'default' === n ||
									Object.prototype.hasOwnProperty.call(e, n) ||
									o(e, t, n);
						},
					a =
						(this && this.__importDefault) ||
						function (t) {
							return t && t.__esModule ? t : { default: t };
						};
				(Object.defineProperty(e, '__esModule', { value: !0 }),
					(e.CotEventTakv =
						e.CotEventTrack =
						e.CotEventStatus =
						e.CotEventPrecisionLocation =
						e.CotEventGroup =
						e.CotEventDetail =
						e.CotEventContact =
						e.CotEvent =
							void 0));
				var i = n(8416);
				(Object.defineProperty(e, 'CotEvent', {
					enumerable: !0,
					get: function () {
						return a(i).default;
					}
				}),
					r(n(8416), e));
				var c = n(4927);
				Object.defineProperty(e, 'CotEventContact', {
					enumerable: !0,
					get: function () {
						return a(c).default;
					}
				});
				var u = n(6067);
				Object.defineProperty(e, 'CotEventDetail', {
					enumerable: !0,
					get: function () {
						return a(u).default;
					}
				});
				var l = n(490);
				Object.defineProperty(e, 'CotEventGroup', {
					enumerable: !0,
					get: function () {
						return a(l).default;
					}
				});
				var s = n(8308);
				Object.defineProperty(e, 'CotEventPrecisionLocation', {
					enumerable: !0,
					get: function () {
						return a(s).default;
					}
				});
				var p = n(3501);
				Object.defineProperty(e, 'CotEventStatus', {
					enumerable: !0,
					get: function () {
						return a(p).default;
					}
				});
				var f = n(5974);
				Object.defineProperty(e, 'CotEventTrack', {
					enumerable: !0,
					get: function () {
						return a(f).default;
					}
				});
				var m = n(7951);
				Object.defineProperty(e, 'CotEventTakv', {
					enumerable: !0,
					get: function () {
						return a(m).default;
					}
				});
			},
			6635: function (t, e, n) {
				var o = n(5198).default,
					r = n(85).default,
					a = n(270).default,
					i = n(4564).default,
					c = n(8240).default;
				Object.defineProperty(e, '__esModule', { value: !0 });
				var u = (function (t) {
					a(n, t);
					var e = i(n);
					function n(t, o, a) {
						var i;
						return (
							r(this, n),
							((i = e.call(
								this,
								''.concat(t, ' ').concat(o, ' is not a valid ').concat(a, '.')
							)).name = 'ValidationError'),
							i
						);
					}
					return o(n);
				})(c(Error));
				e.default = u;
			},
			3815: function (t, e, n) {
				var o,
					r = n(1068).default,
					a = n(1260).default,
					i =
						(this && this.__importDefault) ||
						function (t) {
							return t && t.__esModule ? t : { default: t };
						};
				(Object.defineProperty(e, '__esModule', { value: !0 }),
					(e.createEventFilter = e.matchesFilter = e.FilterExclusivity = void 0));
				var c,
					u,
					l = i(n(6635)),
					s = n(9550);
				function p(t) {
					return 'string' === typeof t
						? u.STRING
						: 'function' === typeof t
							? u.FUNCTION
							: u.REGEXP;
				}
				(!(function (t) {
					((t[(t.NONE = 0)] = 'NONE'),
						(t[(t.FIRST_IN = 1)] = 'FIRST_IN'),
						(t[(t.LAST_IN = 2)] = 'LAST_IN'),
						(t[(t.MOST_SPECIFIC = 3)] = 'MOST_SPECIFIC'));
				})((c = e.FilterExclusivity || (e.FilterExclusivity = {}))),
					(function (t) {
						((t[(t.STRING = 3)] = 'STRING'),
							(t[(t.REGEXP = 2)] = 'REGEXP'),
							(t[(t.FUNCTION = 1)] = 'FUNCTION'));
					})(u || (u = {})));
				var f = function (t) {
						return function (e, n, o) {
							var r = [],
								a = [],
								i = t(n, o);
							return (
								i ? (r.push(i[1]), a.push(i)) : (i = t(e, o)) && r.push(i[1]),
								[r, a]
							);
						};
					},
					m = f(function (t, e) {
						for (var n = 0; n < t.length; n++) {
							var o = t[n];
							if (g(o[0], e)) return o;
						}
						return null;
					}),
					d = f(function (t, e) {
						for (var n = null, o = 0; o < t.length; o++) {
							var r = t[o];
							g(r[0], e) && (n = r);
						}
						return n;
					}),
					v = f(function (t, e) {
						for (var n = null, o = 0; o < t.length; o++) {
							var r = t[o];
							(!n || p(r[0]) > p(n[0])) && g(r[0], e) && (n = r);
						}
						return n;
					}),
					h =
						(a((o = {}), c.NONE, function (t, e, n) {
							var o = [],
								r = [],
								a = function (t, e) {
									g(t[0], n) && (o.push(t[1]), e && r.push(t));
								};
							return (
								t.forEach(function (t) {
									a(t, !1);
								}),
								e.forEach(function (t) {
									a(t, !0);
								}),
								[o, r]
							);
						}),
						a(o, c.FIRST_IN, m),
						a(o, c.LAST_IN, d),
						a(o, c.MOST_SPECIFIC, v),
						o),
					y = s.isInstanceOf(RegExp);
				function g(t, e) {
					if (s.isString(t)) return e.type === t;
					if (s.isFunction(t)) return !!t(e);
					if (y(t)) return t.test(e.type);
					throw new l.default(
						'matchesFilter',
						'argument "filter"',
						'string, function, or instance of RegExp.'
					);
				}
				function b(t, e) {
					t.forEach(function (t) {
						try {
							t(e);
						} catch (n) {}
					});
				}
				e.matchesFilter = g;
				function k() {
					var t = arguments.length > 0 && void 0 !== arguments[0] ? arguments[0] : c.NONE,
						e = [],
						n = [],
						o = h[t],
						a = {
							on: function (t, n) {
								e.push([t, n]);
							},
							once: function (t, e) {
								n.push([t, e]);
							},
							off: function (t, o) {
								var a =
									'function' === typeof t
										? function (e) {
												var n = r(e, 2),
													a = n[0],
													i = n[1];
												return a !== t || i !== o;
											}
										: function (e) {
												var n = r(e, 2),
													a = n[0],
													i = n[1];
												return String(a) !== String(t) || i !== o;
											};
								((e = e.filter(a)), (n = n.filter(a)));
							},
							clear: function () {
								((e = []), (n = []));
							},
							emit: function (t) {
								for (
									var a = o(e, n, t),
										i = r(a, 2),
										c = i[0],
										u = i[1],
										l = function (t) {
											var e = u[t],
												o =
													'function' === typeof e[0]
														? function (t) {
																var n = r(t, 2),
																	o = n[0],
																	a = n[1];
																return o !== e[0] || a !== e[1];
															}
														: function (t) {
																var n = r(t, 2),
																	o = n[0],
																	a = n[1];
																return (
																	String(o) !== String(e[0]) ||
																	a !== e[1]
																);
															};
											n = n.filter(o);
										},
										p = 0;
									p < u.length;
									p++
								)
									l(p);
								if (!c.length) return !1;
								var f = s.chunk(c, 5),
									m = 0;
								return (
									s.queueTask(function e() {
										(b(f[m], t), ++m < f.length && setTimeout(e, 16));
									}),
									!0
								);
							}
						};
					return a;
				}
				((e.createEventFilter = k), (e.default = k));
			},
			2797: function (t, e, n) {
				var o =
						(this && this.__createBinding) ||
						(Object.create
							? function (t, e, n, o) {
									(void 0 === o && (o = n),
										Object.defineProperty(t, o, {
											enumerable: !0,
											get: function () {
												return e[n];
											}
										}));
								}
							: function (t, e, n, o) {
									(void 0 === o && (o = n), (t[o] = e[n]));
								}),
					r =
						(this && this.__exportStar) ||
						function (t, e) {
							for (var n in t)
								'default' === n ||
									Object.prototype.hasOwnProperty.call(e, n) ||
									o(e, t, n);
						};
				(Object.defineProperty(e, '__esModule', { value: !0 }),
					r(n(3815), e),
					r(n(7919), e),
					r(n(6771), e),
					r(n(6098), e));
			},
			7919: function (t, e, n) {
				var o =
					(this && this.__importDefault) ||
					function (t) {
						return t && t.__esModule ? t : { default: t };
					};
				(Object.defineProperty(e, '__esModule', { value: !0 }),
					(e.encodeTakMessage =
						e.extractTakMessage =
						e.PROTO_CONVERSION_OPTIONS =
						e.MAGIC_BYTE =
							void 0));
				var r = n(9550),
					a = o(n(6173)).default.atakmap.commoncommo.protobuf.v1;
				((e.MAGIC_BYTE = 191),
					(e.PROTO_CONVERSION_OPTIONS = {
						enums: String,
						longs: Number,
						defaults: !0,
						arrays: !0,
						objects: !0
					}),
					(e.extractTakMessage = function (t) {
						var n = new Uint8Array(t);
						if (n.byteLength < 2) throw new Error('Cannot parse empty message');
						if (n[0] !== e.MAGIC_BYTE) throw new Error('Invalid message header.');
						var o = a.TakMessage.toObject(
								a.TakMessage.decodeDelimited(n.slice(1)),
								e.PROTO_CONVERSION_OPTIONS
							),
							i = o;
						return o.cotEvent
							? (o.cotEvent.detail
									? (o.cotEvent.detail.xmlDetail
											? (i.cotEvent.detail.xml = r.fromXML(
													i.cotEvent.detail.xmlDetail,
													!0
												))
											: (i.cotEvent.detail.xml = null),
										(i.cotEvent.detail.xmlDetail = null))
									: (i.cotEvent.detail = null),
								i)
							: null;
					}),
					(e.encodeTakMessage = function (t) {
						var n = a.TakMessage.verify(t);
						if (null !== n) throw new Error('Invalid TakMessage provided: '.concat(n));
						var o = Object.assign({}, t);
						t.cotEvent
							? ((t.cotEvent = Object.assign({}, t.cotEvent)),
								t.cotEvent.detail
									? ((t.cotEvent.detail = Object.assign({}, t.cotEvent.detail)),
										t.cotEvent.detail.xml
											? (o.cotEvent.detail.xmlDetail = r.toXML(
													o.cotEvent.detail.xml,
													!1
												))
											: ((o.cotEvent.detail.xmlDetail = null),
												delete o.cotEvent.detail.xmlDetail),
										(o.cotEvent.detail.xml = null),
										delete o.cotEvent.detail.xml)
									: ((o.cotEvent.detail = null), delete o.cotEvent.detail))
							: ((o.cotEvent = null), delete o.cotEvent);
						var i = a.TakMessage.encodeDelimited(o).finish(),
							c = new Uint8Array(i.length + 1);
						return (c.set([e.MAGIC_BYTE]), c.set(i, 1), c);
					}));
			},
			6173: function (t, e, n) {
				(n.r(e),
					n.d(e, {
						atakmap: function () {
							return u;
						},
						default: function () {
							return c;
						}
					}));
				var o = n(7796),
					r = o.Reader,
					a = o.Writer,
					i = o.util,
					c = o.roots.default || (o.roots.default = {}),
					u = (c.atakmap = (function () {
						var t = {};
						return (
							(t.commoncommo = (function () {
								var t = {};
								return (
									(t.protobuf = (function () {
										var t = {};
										return (
											(t.v1 = (function () {
												var t = {};
												return (
													(t.Contact = (function () {
														function t(t) {
															if (t)
																for (
																	var e = Object.keys(t), n = 0;
																	n < e.length;
																	++n
																)
																	null != t[e[n]] &&
																		(this[e[n]] = t[e[n]]);
														}
														return (
															(t.prototype.endpoint = ''),
															(t.prototype.callsign = ''),
															(t.create = function (e) {
																return new t(e);
															}),
															(t.encode = function (t, e) {
																return (
																	e || (e = a.create()),
																	null != t.endpoint &&
																		Object.hasOwnProperty.call(
																			t,
																			'endpoint'
																		) &&
																		e
																			.uint32(10)
																			.string(t.endpoint),
																	null != t.callsign &&
																		Object.hasOwnProperty.call(
																			t,
																			'callsign'
																		) &&
																		e
																			.uint32(18)
																			.string(t.callsign),
																	e
																);
															}),
															(t.encodeDelimited = function (t, e) {
																return this.encode(t, e).ldelim();
															}),
															(t.decode = function (t, e) {
																t instanceof r || (t = r.create(t));
																for (
																	var n =
																			void 0 === e
																				? t.len
																				: t.pos + e,
																		o =
																			new c.atakmap.commoncommo.protobuf.v1.Contact();
																	t.pos < n;

																) {
																	var a = t.uint32();
																	switch (a >>> 3) {
																		case 1:
																			o.endpoint = t.string();
																			break;
																		case 2:
																			o.callsign = t.string();
																			break;
																		default:
																			t.skipType(7 & a);
																	}
																}
																return o;
															}),
															(t.decodeDelimited = function (t) {
																return (
																	t instanceof r ||
																		(t = new r(t)),
																	this.decode(t, t.uint32())
																);
															}),
															(t.verify = function (t) {
																return 'object' !== typeof t ||
																	null === t
																	? 'object expected'
																	: null != t.endpoint &&
																		  t.hasOwnProperty(
																				'endpoint'
																		  ) &&
																		  !i.isString(t.endpoint)
																		? 'endpoint: string expected'
																		: null != t.callsign &&
																			  t.hasOwnProperty(
																					'callsign'
																			  ) &&
																			  !i.isString(
																					t.callsign
																			  )
																			? 'callsign: string expected'
																			: null;
															}),
															(t.fromObject = function (t) {
																if (
																	t instanceof
																	c.atakmap.commoncommo.protobuf
																		.v1.Contact
																)
																	return t;
																var e =
																	new c.atakmap.commoncommo.protobuf.v1.Contact();
																return (
																	null != t.endpoint &&
																		(e.endpoint = String(
																			t.endpoint
																		)),
																	null != t.callsign &&
																		(e.callsign = String(
																			t.callsign
																		)),
																	e
																);
															}),
															(t.toObject = function (t, e) {
																e || (e = {});
																var n = {};
																return (
																	e.defaults &&
																		((n.endpoint = ''),
																		(n.callsign = '')),
																	null != t.endpoint &&
																		t.hasOwnProperty(
																			'endpoint'
																		) &&
																		(n.endpoint = t.endpoint),
																	null != t.callsign &&
																		t.hasOwnProperty(
																			'callsign'
																		) &&
																		(n.callsign = t.callsign),
																	n
																);
															}),
															(t.prototype.toJSON = function () {
																return this.constructor.toObject(
																	this,
																	o.util.toJSONOptions
																);
															}),
															t
														);
													})()),
													(t.CotEvent = (function () {
														function t(t) {
															if (t)
																for (
																	var e = Object.keys(t), n = 0;
																	n < e.length;
																	++n
																)
																	null != t[e[n]] &&
																		(this[e[n]] = t[e[n]]);
														}
														return (
															(t.prototype.type = ''),
															(t.prototype.access = ''),
															(t.prototype.qos = ''),
															(t.prototype.opex = ''),
															(t.prototype.uid = ''),
															(t.prototype.sendTime = i.Long
																? i.Long.fromBits(0, 0, !0)
																: 0),
															(t.prototype.startTime = i.Long
																? i.Long.fromBits(0, 0, !0)
																: 0),
															(t.prototype.staleTime = i.Long
																? i.Long.fromBits(0, 0, !0)
																: 0),
															(t.prototype.how = ''),
															(t.prototype.lat = 0),
															(t.prototype.lon = 0),
															(t.prototype.hae = 0),
															(t.prototype.ce = 0),
															(t.prototype.le = 0),
															(t.prototype.detail = null),
															(t.create = function (e) {
																return new t(e);
															}),
															(t.encode = function (t, e) {
																return (
																	e || (e = a.create()),
																	null != t.type &&
																		Object.hasOwnProperty.call(
																			t,
																			'type'
																		) &&
																		e.uint32(10).string(t.type),
																	null != t.access &&
																		Object.hasOwnProperty.call(
																			t,
																			'access'
																		) &&
																		e
																			.uint32(18)
																			.string(t.access),
																	null != t.qos &&
																		Object.hasOwnProperty.call(
																			t,
																			'qos'
																		) &&
																		e.uint32(26).string(t.qos),
																	null != t.opex &&
																		Object.hasOwnProperty.call(
																			t,
																			'opex'
																		) &&
																		e.uint32(34).string(t.opex),
																	null != t.uid &&
																		Object.hasOwnProperty.call(
																			t,
																			'uid'
																		) &&
																		e.uint32(42).string(t.uid),
																	null != t.sendTime &&
																		Object.hasOwnProperty.call(
																			t,
																			'sendTime'
																		) &&
																		e
																			.uint32(48)
																			.uint64(t.sendTime),
																	null != t.startTime &&
																		Object.hasOwnProperty.call(
																			t,
																			'startTime'
																		) &&
																		e
																			.uint32(56)
																			.uint64(t.startTime),
																	null != t.staleTime &&
																		Object.hasOwnProperty.call(
																			t,
																			'staleTime'
																		) &&
																		e
																			.uint32(64)
																			.uint64(t.staleTime),
																	null != t.how &&
																		Object.hasOwnProperty.call(
																			t,
																			'how'
																		) &&
																		e.uint32(74).string(t.how),
																	null != t.lat &&
																		Object.hasOwnProperty.call(
																			t,
																			'lat'
																		) &&
																		e.uint32(81).double(t.lat),
																	null != t.lon &&
																		Object.hasOwnProperty.call(
																			t,
																			'lon'
																		) &&
																		e.uint32(89).double(t.lon),
																	null != t.hae &&
																		Object.hasOwnProperty.call(
																			t,
																			'hae'
																		) &&
																		e.uint32(97).double(t.hae),
																	null != t.ce &&
																		Object.hasOwnProperty.call(
																			t,
																			'ce'
																		) &&
																		e.uint32(105).double(t.ce),
																	null != t.le &&
																		Object.hasOwnProperty.call(
																			t,
																			'le'
																		) &&
																		e.uint32(113).double(t.le),
																	null != t.detail &&
																		Object.hasOwnProperty.call(
																			t,
																			'detail'
																		) &&
																		c.atakmap.commoncommo.protobuf.v1.Detail.encode(
																			t.detail,
																			e.uint32(122).fork()
																		).ldelim(),
																	e
																);
															}),
															(t.encodeDelimited = function (t, e) {
																return this.encode(t, e).ldelim();
															}),
															(t.decode = function (t, e) {
																t instanceof r || (t = r.create(t));
																for (
																	var n =
																			void 0 === e
																				? t.len
																				: t.pos + e,
																		o =
																			new c.atakmap.commoncommo.protobuf.v1.CotEvent();
																	t.pos < n;

																) {
																	var a = t.uint32();
																	switch (a >>> 3) {
																		case 1:
																			o.type = t.string();
																			break;
																		case 2:
																			o.access = t.string();
																			break;
																		case 3:
																			o.qos = t.string();
																			break;
																		case 4:
																			o.opex = t.string();
																			break;
																		case 5:
																			o.uid = t.string();
																			break;
																		case 6:
																			o.sendTime = t.uint64();
																			break;
																		case 7:
																			o.startTime =
																				t.uint64();
																			break;
																		case 8:
																			o.staleTime =
																				t.uint64();
																			break;
																		case 9:
																			o.how = t.string();
																			break;
																		case 10:
																			o.lat = t.double();
																			break;
																		case 11:
																			o.lon = t.double();
																			break;
																		case 12:
																			o.hae = t.double();
																			break;
																		case 13:
																			o.ce = t.double();
																			break;
																		case 14:
																			o.le = t.double();
																			break;
																		case 15:
																			o.detail =
																				c.atakmap.commoncommo.protobuf.v1.Detail.decode(
																					t,
																					t.uint32()
																				);
																			break;
																		default:
																			t.skipType(7 & a);
																	}
																}
																return o;
															}),
															(t.decodeDelimited = function (t) {
																return (
																	t instanceof r ||
																		(t = new r(t)),
																	this.decode(t, t.uint32())
																);
															}),
															(t.verify = function (t) {
																if (
																	'object' !== typeof t ||
																	null === t
																)
																	return 'object expected';
																if (
																	null != t.type &&
																	t.hasOwnProperty('type') &&
																	!i.isString(t.type)
																)
																	return 'type: string expected';
																if (
																	null != t.access &&
																	t.hasOwnProperty('access') &&
																	!i.isString(t.access)
																)
																	return 'access: string expected';
																if (
																	null != t.qos &&
																	t.hasOwnProperty('qos') &&
																	!i.isString(t.qos)
																)
																	return 'qos: string expected';
																if (
																	null != t.opex &&
																	t.hasOwnProperty('opex') &&
																	!i.isString(t.opex)
																)
																	return 'opex: string expected';
																if (
																	null != t.uid &&
																	t.hasOwnProperty('uid') &&
																	!i.isString(t.uid)
																)
																	return 'uid: string expected';
																if (
																	null != t.sendTime &&
																	t.hasOwnProperty('sendTime') &&
																	!i.isInteger(t.sendTime) &&
																	!(
																		t.sendTime &&
																		i.isInteger(
																			t.sendTime.low
																		) &&
																		i.isInteger(t.sendTime.high)
																	)
																)
																	return 'sendTime: integer|Long expected';
																if (
																	null != t.startTime &&
																	t.hasOwnProperty('startTime') &&
																	!i.isInteger(t.startTime) &&
																	!(
																		t.startTime &&
																		i.isInteger(
																			t.startTime.low
																		) &&
																		i.isInteger(
																			t.startTime.high
																		)
																	)
																)
																	return 'startTime: integer|Long expected';
																if (
																	null != t.staleTime &&
																	t.hasOwnProperty('staleTime') &&
																	!i.isInteger(t.staleTime) &&
																	!(
																		t.staleTime &&
																		i.isInteger(
																			t.staleTime.low
																		) &&
																		i.isInteger(
																			t.staleTime.high
																		)
																	)
																)
																	return 'staleTime: integer|Long expected';
																if (
																	null != t.how &&
																	t.hasOwnProperty('how') &&
																	!i.isString(t.how)
																)
																	return 'how: string expected';
																if (
																	null != t.lat &&
																	t.hasOwnProperty('lat') &&
																	'number' !== typeof t.lat
																)
																	return 'lat: number expected';
																if (
																	null != t.lon &&
																	t.hasOwnProperty('lon') &&
																	'number' !== typeof t.lon
																)
																	return 'lon: number expected';
																if (
																	null != t.hae &&
																	t.hasOwnProperty('hae') &&
																	'number' !== typeof t.hae
																)
																	return 'hae: number expected';
																if (
																	null != t.ce &&
																	t.hasOwnProperty('ce') &&
																	'number' !== typeof t.ce
																)
																	return 'ce: number expected';
																if (
																	null != t.le &&
																	t.hasOwnProperty('le') &&
																	'number' !== typeof t.le
																)
																	return 'le: number expected';
																if (
																	null != t.detail &&
																	t.hasOwnProperty('detail')
																) {
																	var e =
																		c.atakmap.commoncommo.protobuf.v1.Detail.verify(
																			t.detail
																		);
																	if (e) return 'detail.' + e;
																}
																return null;
															}),
															(t.fromObject = function (t) {
																if (
																	t instanceof
																	c.atakmap.commoncommo.protobuf
																		.v1.CotEvent
																)
																	return t;
																var e =
																	new c.atakmap.commoncommo.protobuf.v1.CotEvent();
																if (
																	(null != t.type &&
																		(e.type = String(t.type)),
																	null != t.access &&
																		(e.access = String(
																			t.access
																		)),
																	null != t.qos &&
																		(e.qos = String(t.qos)),
																	null != t.opex &&
																		(e.opex = String(t.opex)),
																	null != t.uid &&
																		(e.uid = String(t.uid)),
																	null != t.sendTime &&
																		(i.Long
																			? ((e.sendTime =
																					i.Long.fromValue(
																						t.sendTime
																					)).unsigned =
																					!0)
																			: 'string' ===
																				  typeof t.sendTime
																				? (e.sendTime =
																						parseInt(
																							t.sendTime,
																							10
																						))
																				: 'number' ===
																					  typeof t.sendTime
																					? (e.sendTime =
																							t.sendTime)
																					: 'object' ===
																							typeof t.sendTime &&
																						(e.sendTime =
																							new i.LongBits(
																								t
																									.sendTime
																									.low >>>
																									0,
																								t
																									.sendTime
																									.high >>>
																									0
																							).toNumber(
																								!0
																							))),
																	null != t.startTime &&
																		(i.Long
																			? ((e.startTime =
																					i.Long.fromValue(
																						t.startTime
																					)).unsigned =
																					!0)
																			: 'string' ===
																				  typeof t.startTime
																				? (e.startTime =
																						parseInt(
																							t.startTime,
																							10
																						))
																				: 'number' ===
																					  typeof t.startTime
																					? (e.startTime =
																							t.startTime)
																					: 'object' ===
																							typeof t.startTime &&
																						(e.startTime =
																							new i.LongBits(
																								t
																									.startTime
																									.low >>>
																									0,
																								t
																									.startTime
																									.high >>>
																									0
																							).toNumber(
																								!0
																							))),
																	null != t.staleTime &&
																		(i.Long
																			? ((e.staleTime =
																					i.Long.fromValue(
																						t.staleTime
																					)).unsigned =
																					!0)
																			: 'string' ===
																				  typeof t.staleTime
																				? (e.staleTime =
																						parseInt(
																							t.staleTime,
																							10
																						))
																				: 'number' ===
																					  typeof t.staleTime
																					? (e.staleTime =
																							t.staleTime)
																					: 'object' ===
																							typeof t.staleTime &&
																						(e.staleTime =
																							new i.LongBits(
																								t
																									.staleTime
																									.low >>>
																									0,
																								t
																									.staleTime
																									.high >>>
																									0
																							).toNumber(
																								!0
																							))),
																	null != t.how &&
																		(e.how = String(t.how)),
																	null != t.lat &&
																		(e.lat = Number(t.lat)),
																	null != t.lon &&
																		(e.lon = Number(t.lon)),
																	null != t.hae &&
																		(e.hae = Number(t.hae)),
																	null != t.ce &&
																		(e.ce = Number(t.ce)),
																	null != t.le &&
																		(e.le = Number(t.le)),
																	null != t.detail)
																) {
																	if (
																		'object' !== typeof t.detail
																	)
																		throw TypeError(
																			'.atakmap.commoncommo.protobuf.v1.CotEvent.detail: object expected'
																		);
																	e.detail =
																		c.atakmap.commoncommo.protobuf.v1.Detail.fromObject(
																			t.detail
																		);
																}
																return e;
															}),
															(t.toObject = function (t, e) {
																e || (e = {});
																var n = {};
																if (e.defaults) {
																	if (
																		((n.type = ''),
																		(n.access = ''),
																		(n.qos = ''),
																		(n.opex = ''),
																		(n.uid = ''),
																		i.Long)
																	) {
																		var o = new i.Long(
																			0,
																			0,
																			!0
																		);
																		n.sendTime =
																			e.longs === String
																				? o.toString()
																				: e.longs === Number
																					? o.toNumber()
																					: o;
																	} else
																		n.sendTime =
																			e.longs === String
																				? '0'
																				: 0;
																	if (i.Long) {
																		var r = new i.Long(
																			0,
																			0,
																			!0
																		);
																		n.startTime =
																			e.longs === String
																				? r.toString()
																				: e.longs === Number
																					? r.toNumber()
																					: r;
																	} else
																		n.startTime =
																			e.longs === String
																				? '0'
																				: 0;
																	if (i.Long) {
																		var a = new i.Long(
																			0,
																			0,
																			!0
																		);
																		n.staleTime =
																			e.longs === String
																				? a.toString()
																				: e.longs === Number
																					? a.toNumber()
																					: a;
																	} else
																		n.staleTime =
																			e.longs === String
																				? '0'
																				: 0;
																	((n.how = ''),
																		(n.lat = 0),
																		(n.lon = 0),
																		(n.hae = 0),
																		(n.ce = 0),
																		(n.le = 0),
																		(n.detail = null));
																}
																return (
																	null != t.type &&
																		t.hasOwnProperty('type') &&
																		(n.type = t.type),
																	null != t.access &&
																		t.hasOwnProperty(
																			'access'
																		) &&
																		(n.access = t.access),
																	null != t.qos &&
																		t.hasOwnProperty('qos') &&
																		(n.qos = t.qos),
																	null != t.opex &&
																		t.hasOwnProperty('opex') &&
																		(n.opex = t.opex),
																	null != t.uid &&
																		t.hasOwnProperty('uid') &&
																		(n.uid = t.uid),
																	null != t.sendTime &&
																		t.hasOwnProperty(
																			'sendTime'
																		) &&
																		('number' ===
																		typeof t.sendTime
																			? (n.sendTime =
																					e.longs ===
																					String
																						? String(
																								t.sendTime
																							)
																						: t.sendTime)
																			: (n.sendTime =
																					e.longs ===
																					String
																						? i.Long.prototype.toString.call(
																								t.sendTime
																							)
																						: e.longs ===
																							  Number
																							? new i.LongBits(
																									t
																										.sendTime
																										.low >>>
																										0,
																									t
																										.sendTime
																										.high >>>
																										0
																								).toNumber(
																									!0
																								)
																							: t.sendTime)),
																	null != t.startTime &&
																		t.hasOwnProperty(
																			'startTime'
																		) &&
																		('number' ===
																		typeof t.startTime
																			? (n.startTime =
																					e.longs ===
																					String
																						? String(
																								t.startTime
																							)
																						: t.startTime)
																			: (n.startTime =
																					e.longs ===
																					String
																						? i.Long.prototype.toString.call(
																								t.startTime
																							)
																						: e.longs ===
																							  Number
																							? new i.LongBits(
																									t
																										.startTime
																										.low >>>
																										0,
																									t
																										.startTime
																										.high >>>
																										0
																								).toNumber(
																									!0
																								)
																							: t.startTime)),
																	null != t.staleTime &&
																		t.hasOwnProperty(
																			'staleTime'
																		) &&
																		('number' ===
																		typeof t.staleTime
																			? (n.staleTime =
																					e.longs ===
																					String
																						? String(
																								t.staleTime
																							)
																						: t.staleTime)
																			: (n.staleTime =
																					e.longs ===
																					String
																						? i.Long.prototype.toString.call(
																								t.staleTime
																							)
																						: e.longs ===
																							  Number
																							? new i.LongBits(
																									t
																										.staleTime
																										.low >>>
																										0,
																									t
																										.staleTime
																										.high >>>
																										0
																								).toNumber(
																									!0
																								)
																							: t.staleTime)),
																	null != t.how &&
																		t.hasOwnProperty('how') &&
																		(n.how = t.how),
																	null != t.lat &&
																		t.hasOwnProperty('lat') &&
																		(n.lat =
																			e.json &&
																			!isFinite(t.lat)
																				? String(t.lat)
																				: t.lat),
																	null != t.lon &&
																		t.hasOwnProperty('lon') &&
																		(n.lon =
																			e.json &&
																			!isFinite(t.lon)
																				? String(t.lon)
																				: t.lon),
																	null != t.hae &&
																		t.hasOwnProperty('hae') &&
																		(n.hae =
																			e.json &&
																			!isFinite(t.hae)
																				? String(t.hae)
																				: t.hae),
																	null != t.ce &&
																		t.hasOwnProperty('ce') &&
																		(n.ce =
																			e.json &&
																			!isFinite(t.ce)
																				? String(t.ce)
																				: t.ce),
																	null != t.le &&
																		t.hasOwnProperty('le') &&
																		(n.le =
																			e.json &&
																			!isFinite(t.le)
																				? String(t.le)
																				: t.le),
																	null != t.detail &&
																		t.hasOwnProperty(
																			'detail'
																		) &&
																		(n.detail =
																			c.atakmap.commoncommo.protobuf.v1.Detail.toObject(
																				t.detail,
																				e
																			)),
																	n
																);
															}),
															(t.prototype.toJSON = function () {
																return this.constructor.toObject(
																	this,
																	o.util.toJSONOptions
																);
															}),
															t
														);
													})()),
													(t.Detail = (function () {
														function t(t) {
															if (t)
																for (
																	var e = Object.keys(t), n = 0;
																	n < e.length;
																	++n
																)
																	null != t[e[n]] &&
																		(this[e[n]] = t[e[n]]);
														}
														return (
															(t.prototype.xmlDetail = ''),
															(t.prototype.contact = null),
															(t.prototype.group = null),
															(t.prototype.precisionLocation = null),
															(t.prototype.status = null),
															(t.prototype.takv = null),
															(t.prototype.track = null),
															(t.create = function (e) {
																return new t(e);
															}),
															(t.encode = function (t, e) {
																return (
																	e || (e = a.create()),
																	null != t.xmlDetail &&
																		Object.hasOwnProperty.call(
																			t,
																			'xmlDetail'
																		) &&
																		e
																			.uint32(10)
																			.string(t.xmlDetail),
																	null != t.contact &&
																		Object.hasOwnProperty.call(
																			t,
																			'contact'
																		) &&
																		c.atakmap.commoncommo.protobuf.v1.Contact.encode(
																			t.contact,
																			e.uint32(18).fork()
																		).ldelim(),
																	null != t.group &&
																		Object.hasOwnProperty.call(
																			t,
																			'group'
																		) &&
																		c.atakmap.commoncommo.protobuf.v1.Group.encode(
																			t.group,
																			e.uint32(26).fork()
																		).ldelim(),
																	null != t.precisionLocation &&
																		Object.hasOwnProperty.call(
																			t,
																			'precisionLocation'
																		) &&
																		c.atakmap.commoncommo.protobuf.v1.PrecisionLocation.encode(
																			t.precisionLocation,
																			e.uint32(34).fork()
																		).ldelim(),
																	null != t.status &&
																		Object.hasOwnProperty.call(
																			t,
																			'status'
																		) &&
																		c.atakmap.commoncommo.protobuf.v1.Status.encode(
																			t.status,
																			e.uint32(42).fork()
																		).ldelim(),
																	null != t.takv &&
																		Object.hasOwnProperty.call(
																			t,
																			'takv'
																		) &&
																		c.atakmap.commoncommo.protobuf.v1.Takv.encode(
																			t.takv,
																			e.uint32(50).fork()
																		).ldelim(),
																	null != t.track &&
																		Object.hasOwnProperty.call(
																			t,
																			'track'
																		) &&
																		c.atakmap.commoncommo.protobuf.v1.Track.encode(
																			t.track,
																			e.uint32(58).fork()
																		).ldelim(),
																	e
																);
															}),
															(t.encodeDelimited = function (t, e) {
																return this.encode(t, e).ldelim();
															}),
															(t.decode = function (t, e) {
																t instanceof r || (t = r.create(t));
																for (
																	var n =
																			void 0 === e
																				? t.len
																				: t.pos + e,
																		o =
																			new c.atakmap.commoncommo.protobuf.v1.Detail();
																	t.pos < n;

																) {
																	var a = t.uint32();
																	switch (a >>> 3) {
																		case 1:
																			o.xmlDetail =
																				t.string();
																			break;
																		case 2:
																			o.contact =
																				c.atakmap.commoncommo.protobuf.v1.Contact.decode(
																					t,
																					t.uint32()
																				);
																			break;
																		case 3:
																			o.group =
																				c.atakmap.commoncommo.protobuf.v1.Group.decode(
																					t,
																					t.uint32()
																				);
																			break;
																		case 4:
																			o.precisionLocation =
																				c.atakmap.commoncommo.protobuf.v1.PrecisionLocation.decode(
																					t,
																					t.uint32()
																				);
																			break;
																		case 5:
																			o.status =
																				c.atakmap.commoncommo.protobuf.v1.Status.decode(
																					t,
																					t.uint32()
																				);
																			break;
																		case 6:
																			o.takv =
																				c.atakmap.commoncommo.protobuf.v1.Takv.decode(
																					t,
																					t.uint32()
																				);
																			break;
																		case 7:
																			o.track =
																				c.atakmap.commoncommo.protobuf.v1.Track.decode(
																					t,
																					t.uint32()
																				);
																			break;
																		default:
																			t.skipType(7 & a);
																	}
																}
																return o;
															}),
															(t.decodeDelimited = function (t) {
																return (
																	t instanceof r ||
																		(t = new r(t)),
																	this.decode(t, t.uint32())
																);
															}),
															(t.verify = function (t) {
																if (
																	'object' !== typeof t ||
																	null === t
																)
																	return 'object expected';
																if (
																	null != t.xmlDetail &&
																	t.hasOwnProperty('xmlDetail') &&
																	!i.isString(t.xmlDetail)
																)
																	return 'xmlDetail: string expected';
																if (
																	null != t.contact &&
																	t.hasOwnProperty('contact')
																) {
																	var e =
																		c.atakmap.commoncommo.protobuf.v1.Contact.verify(
																			t.contact
																		);
																	if (e) return 'contact.' + e;
																}
																if (
																	null != t.group &&
																	t.hasOwnProperty('group')
																) {
																	var n =
																		c.atakmap.commoncommo.protobuf.v1.Group.verify(
																			t.group
																		);
																	if (n) return 'group.' + n;
																}
																if (
																	null != t.precisionLocation &&
																	t.hasOwnProperty(
																		'precisionLocation'
																	)
																) {
																	var o =
																		c.atakmap.commoncommo.protobuf.v1.PrecisionLocation.verify(
																			t.precisionLocation
																		);
																	if (o)
																		return (
																			'precisionLocation.' + o
																		);
																}
																if (
																	null != t.status &&
																	t.hasOwnProperty('status')
																) {
																	var r =
																		c.atakmap.commoncommo.protobuf.v1.Status.verify(
																			t.status
																		);
																	if (r) return 'status.' + r;
																}
																if (
																	null != t.takv &&
																	t.hasOwnProperty('takv')
																) {
																	var a =
																		c.atakmap.commoncommo.protobuf.v1.Takv.verify(
																			t.takv
																		);
																	if (a) return 'takv.' + a;
																}
																if (
																	null != t.track &&
																	t.hasOwnProperty('track')
																) {
																	var u =
																		c.atakmap.commoncommo.protobuf.v1.Track.verify(
																			t.track
																		);
																	if (u) return 'track.' + u;
																}
																return null;
															}),
															(t.fromObject = function (t) {
																if (
																	t instanceof
																	c.atakmap.commoncommo.protobuf
																		.v1.Detail
																)
																	return t;
																var e =
																	new c.atakmap.commoncommo.protobuf.v1.Detail();
																if (
																	(null != t.xmlDetail &&
																		(e.xmlDetail = String(
																			t.xmlDetail
																		)),
																	null != t.contact)
																) {
																	if (
																		'object' !==
																		typeof t.contact
																	)
																		throw TypeError(
																			'.atakmap.commoncommo.protobuf.v1.Detail.contact: object expected'
																		);
																	e.contact =
																		c.atakmap.commoncommo.protobuf.v1.Contact.fromObject(
																			t.contact
																		);
																}
																if (null != t.group) {
																	if ('object' !== typeof t.group)
																		throw TypeError(
																			'.atakmap.commoncommo.protobuf.v1.Detail.group: object expected'
																		);
																	e.group =
																		c.atakmap.commoncommo.protobuf.v1.Group.fromObject(
																			t.group
																		);
																}
																if (null != t.precisionLocation) {
																	if (
																		'object' !==
																		typeof t.precisionLocation
																	)
																		throw TypeError(
																			'.atakmap.commoncommo.protobuf.v1.Detail.precisionLocation: object expected'
																		);
																	e.precisionLocation =
																		c.atakmap.commoncommo.protobuf.v1.PrecisionLocation.fromObject(
																			t.precisionLocation
																		);
																}
																if (null != t.status) {
																	if (
																		'object' !== typeof t.status
																	)
																		throw TypeError(
																			'.atakmap.commoncommo.protobuf.v1.Detail.status: object expected'
																		);
																	e.status =
																		c.atakmap.commoncommo.protobuf.v1.Status.fromObject(
																			t.status
																		);
																}
																if (null != t.takv) {
																	if ('object' !== typeof t.takv)
																		throw TypeError(
																			'.atakmap.commoncommo.protobuf.v1.Detail.takv: object expected'
																		);
																	e.takv =
																		c.atakmap.commoncommo.protobuf.v1.Takv.fromObject(
																			t.takv
																		);
																}
																if (null != t.track) {
																	if ('object' !== typeof t.track)
																		throw TypeError(
																			'.atakmap.commoncommo.protobuf.v1.Detail.track: object expected'
																		);
																	e.track =
																		c.atakmap.commoncommo.protobuf.v1.Track.fromObject(
																			t.track
																		);
																}
																return e;
															}),
															(t.toObject = function (t, e) {
																e || (e = {});
																var n = {};
																return (
																	e.defaults &&
																		((n.xmlDetail = ''),
																		(n.contact = null),
																		(n.group = null),
																		(n.precisionLocation =
																			null),
																		(n.status = null),
																		(n.takv = null),
																		(n.track = null)),
																	null != t.xmlDetail &&
																		t.hasOwnProperty(
																			'xmlDetail'
																		) &&
																		(n.xmlDetail = t.xmlDetail),
																	null != t.contact &&
																		t.hasOwnProperty(
																			'contact'
																		) &&
																		(n.contact =
																			c.atakmap.commoncommo.protobuf.v1.Contact.toObject(
																				t.contact,
																				e
																			)),
																	null != t.group &&
																		t.hasOwnProperty('group') &&
																		(n.group =
																			c.atakmap.commoncommo.protobuf.v1.Group.toObject(
																				t.group,
																				e
																			)),
																	null != t.precisionLocation &&
																		t.hasOwnProperty(
																			'precisionLocation'
																		) &&
																		(n.precisionLocation =
																			c.atakmap.commoncommo.protobuf.v1.PrecisionLocation.toObject(
																				t.precisionLocation,
																				e
																			)),
																	null != t.status &&
																		t.hasOwnProperty(
																			'status'
																		) &&
																		(n.status =
																			c.atakmap.commoncommo.protobuf.v1.Status.toObject(
																				t.status,
																				e
																			)),
																	null != t.takv &&
																		t.hasOwnProperty('takv') &&
																		(n.takv =
																			c.atakmap.commoncommo.protobuf.v1.Takv.toObject(
																				t.takv,
																				e
																			)),
																	null != t.track &&
																		t.hasOwnProperty('track') &&
																		(n.track =
																			c.atakmap.commoncommo.protobuf.v1.Track.toObject(
																				t.track,
																				e
																			)),
																	n
																);
															}),
															(t.prototype.toJSON = function () {
																return this.constructor.toObject(
																	this,
																	o.util.toJSONOptions
																);
															}),
															t
														);
													})()),
													(t.Group = (function () {
														function t(t) {
															if (t)
																for (
																	var e = Object.keys(t), n = 0;
																	n < e.length;
																	++n
																)
																	null != t[e[n]] &&
																		(this[e[n]] = t[e[n]]);
														}
														return (
															(t.prototype.name = ''),
															(t.prototype.role = ''),
															(t.create = function (e) {
																return new t(e);
															}),
															(t.encode = function (t, e) {
																return (
																	e || (e = a.create()),
																	null != t.name &&
																		Object.hasOwnProperty.call(
																			t,
																			'name'
																		) &&
																		e.uint32(10).string(t.name),
																	null != t.role &&
																		Object.hasOwnProperty.call(
																			t,
																			'role'
																		) &&
																		e.uint32(18).string(t.role),
																	e
																);
															}),
															(t.encodeDelimited = function (t, e) {
																return this.encode(t, e).ldelim();
															}),
															(t.decode = function (t, e) {
																t instanceof r || (t = r.create(t));
																for (
																	var n =
																			void 0 === e
																				? t.len
																				: t.pos + e,
																		o =
																			new c.atakmap.commoncommo.protobuf.v1.Group();
																	t.pos < n;

																) {
																	var a = t.uint32();
																	switch (a >>> 3) {
																		case 1:
																			o.name = t.string();
																			break;
																		case 2:
																			o.role = t.string();
																			break;
																		default:
																			t.skipType(7 & a);
																	}
																}
																return o;
															}),
															(t.decodeDelimited = function (t) {
																return (
																	t instanceof r ||
																		(t = new r(t)),
																	this.decode(t, t.uint32())
																);
															}),
															(t.verify = function (t) {
																return 'object' !== typeof t ||
																	null === t
																	? 'object expected'
																	: null != t.name &&
																		  t.hasOwnProperty(
																				'name'
																		  ) &&
																		  !i.isString(t.name)
																		? 'name: string expected'
																		: null != t.role &&
																			  t.hasOwnProperty(
																					'role'
																			  ) &&
																			  !i.isString(t.role)
																			? 'role: string expected'
																			: null;
															}),
															(t.fromObject = function (t) {
																if (
																	t instanceof
																	c.atakmap.commoncommo.protobuf
																		.v1.Group
																)
																	return t;
																var e =
																	new c.atakmap.commoncommo.protobuf.v1.Group();
																return (
																	null != t.name &&
																		(e.name = String(t.name)),
																	null != t.role &&
																		(e.role = String(t.role)),
																	e
																);
															}),
															(t.toObject = function (t, e) {
																e || (e = {});
																var n = {};
																return (
																	e.defaults &&
																		((n.name = ''),
																		(n.role = '')),
																	null != t.name &&
																		t.hasOwnProperty('name') &&
																		(n.name = t.name),
																	null != t.role &&
																		t.hasOwnProperty('role') &&
																		(n.role = t.role),
																	n
																);
															}),
															(t.prototype.toJSON = function () {
																return this.constructor.toObject(
																	this,
																	o.util.toJSONOptions
																);
															}),
															t
														);
													})()),
													(t.PrecisionLocation = (function () {
														function t(t) {
															if (t)
																for (
																	var e = Object.keys(t), n = 0;
																	n < e.length;
																	++n
																)
																	null != t[e[n]] &&
																		(this[e[n]] = t[e[n]]);
														}
														return (
															(t.prototype.geopointsrc = ''),
															(t.prototype.altsrc = ''),
															(t.create = function (e) {
																return new t(e);
															}),
															(t.encode = function (t, e) {
																return (
																	e || (e = a.create()),
																	null != t.geopointsrc &&
																		Object.hasOwnProperty.call(
																			t,
																			'geopointsrc'
																		) &&
																		e
																			.uint32(10)
																			.string(t.geopointsrc),
																	null != t.altsrc &&
																		Object.hasOwnProperty.call(
																			t,
																			'altsrc'
																		) &&
																		e
																			.uint32(18)
																			.string(t.altsrc),
																	e
																);
															}),
															(t.encodeDelimited = function (t, e) {
																return this.encode(t, e).ldelim();
															}),
															(t.decode = function (t, e) {
																t instanceof r || (t = r.create(t));
																for (
																	var n =
																			void 0 === e
																				? t.len
																				: t.pos + e,
																		o =
																			new c.atakmap.commoncommo.protobuf.v1.PrecisionLocation();
																	t.pos < n;

																) {
																	var a = t.uint32();
																	switch (a >>> 3) {
																		case 1:
																			o.geopointsrc =
																				t.string();
																			break;
																		case 2:
																			o.altsrc = t.string();
																			break;
																		default:
																			t.skipType(7 & a);
																	}
																}
																return o;
															}),
															(t.decodeDelimited = function (t) {
																return (
																	t instanceof r ||
																		(t = new r(t)),
																	this.decode(t, t.uint32())
																);
															}),
															(t.verify = function (t) {
																return 'object' !== typeof t ||
																	null === t
																	? 'object expected'
																	: null != t.geopointsrc &&
																		  t.hasOwnProperty(
																				'geopointsrc'
																		  ) &&
																		  !i.isString(t.geopointsrc)
																		? 'geopointsrc: string expected'
																		: null != t.altsrc &&
																			  t.hasOwnProperty(
																					'altsrc'
																			  ) &&
																			  !i.isString(t.altsrc)
																			? 'altsrc: string expected'
																			: null;
															}),
															(t.fromObject = function (t) {
																if (
																	t instanceof
																	c.atakmap.commoncommo.protobuf
																		.v1.PrecisionLocation
																)
																	return t;
																var e =
																	new c.atakmap.commoncommo.protobuf.v1.PrecisionLocation();
																return (
																	null != t.geopointsrc &&
																		(e.geopointsrc = String(
																			t.geopointsrc
																		)),
																	null != t.altsrc &&
																		(e.altsrc = String(
																			t.altsrc
																		)),
																	e
																);
															}),
															(t.toObject = function (t, e) {
																e || (e = {});
																var n = {};
																return (
																	e.defaults &&
																		((n.geopointsrc = ''),
																		(n.altsrc = '')),
																	null != t.geopointsrc &&
																		t.hasOwnProperty(
																			'geopointsrc'
																		) &&
																		(n.geopointsrc =
																			t.geopointsrc),
																	null != t.altsrc &&
																		t.hasOwnProperty(
																			'altsrc'
																		) &&
																		(n.altsrc = t.altsrc),
																	n
																);
															}),
															(t.prototype.toJSON = function () {
																return this.constructor.toObject(
																	this,
																	o.util.toJSONOptions
																);
															}),
															t
														);
													})()),
													(t.Status = (function () {
														function t(t) {
															if (t)
																for (
																	var e = Object.keys(t), n = 0;
																	n < e.length;
																	++n
																)
																	null != t[e[n]] &&
																		(this[e[n]] = t[e[n]]);
														}
														return (
															(t.prototype.battery = 0),
															(t.create = function (e) {
																return new t(e);
															}),
															(t.encode = function (t, e) {
																return (
																	e || (e = a.create()),
																	null != t.battery &&
																		Object.hasOwnProperty.call(
																			t,
																			'battery'
																		) &&
																		e
																			.uint32(8)
																			.uint32(t.battery),
																	e
																);
															}),
															(t.encodeDelimited = function (t, e) {
																return this.encode(t, e).ldelim();
															}),
															(t.decode = function (t, e) {
																t instanceof r || (t = r.create(t));
																for (
																	var n =
																			void 0 === e
																				? t.len
																				: t.pos + e,
																		o =
																			new c.atakmap.commoncommo.protobuf.v1.Status();
																	t.pos < n;

																) {
																	var a = t.uint32();
																	if (a >>> 3 === 1)
																		o.battery = t.uint32();
																	else t.skipType(7 & a);
																}
																return o;
															}),
															(t.decodeDelimited = function (t) {
																return (
																	t instanceof r ||
																		(t = new r(t)),
																	this.decode(t, t.uint32())
																);
															}),
															(t.verify = function (t) {
																return 'object' !== typeof t ||
																	null === t
																	? 'object expected'
																	: null != t.battery &&
																		  t.hasOwnProperty(
																				'battery'
																		  ) &&
																		  !i.isInteger(t.battery)
																		? 'battery: integer expected'
																		: null;
															}),
															(t.fromObject = function (t) {
																if (
																	t instanceof
																	c.atakmap.commoncommo.protobuf
																		.v1.Status
																)
																	return t;
																var e =
																	new c.atakmap.commoncommo.protobuf.v1.Status();
																return (
																	null != t.battery &&
																		(e.battery =
																			t.battery >>> 0),
																	e
																);
															}),
															(t.toObject = function (t, e) {
																e || (e = {});
																var n = {};
																return (
																	e.defaults && (n.battery = 0),
																	null != t.battery &&
																		t.hasOwnProperty(
																			'battery'
																		) &&
																		(n.battery = t.battery),
																	n
																);
															}),
															(t.prototype.toJSON = function () {
																return this.constructor.toObject(
																	this,
																	o.util.toJSONOptions
																);
															}),
															t
														);
													})()),
													(t.Takv = (function () {
														function t(t) {
															if (t)
																for (
																	var e = Object.keys(t), n = 0;
																	n < e.length;
																	++n
																)
																	null != t[e[n]] &&
																		(this[e[n]] = t[e[n]]);
														}
														return (
															(t.prototype.device = ''),
															(t.prototype.platform = ''),
															(t.prototype.os = ''),
															(t.prototype.version = ''),
															(t.create = function (e) {
																return new t(e);
															}),
															(t.encode = function (t, e) {
																return (
																	e || (e = a.create()),
																	null != t.device &&
																		Object.hasOwnProperty.call(
																			t,
																			'device'
																		) &&
																		e
																			.uint32(10)
																			.string(t.device),
																	null != t.platform &&
																		Object.hasOwnProperty.call(
																			t,
																			'platform'
																		) &&
																		e
																			.uint32(18)
																			.string(t.platform),
																	null != t.os &&
																		Object.hasOwnProperty.call(
																			t,
																			'os'
																		) &&
																		e.uint32(26).string(t.os),
																	null != t.version &&
																		Object.hasOwnProperty.call(
																			t,
																			'version'
																		) &&
																		e
																			.uint32(34)
																			.string(t.version),
																	e
																);
															}),
															(t.encodeDelimited = function (t, e) {
																return this.encode(t, e).ldelim();
															}),
															(t.decode = function (t, e) {
																t instanceof r || (t = r.create(t));
																for (
																	var n =
																			void 0 === e
																				? t.len
																				: t.pos + e,
																		o =
																			new c.atakmap.commoncommo.protobuf.v1.Takv();
																	t.pos < n;

																) {
																	var a = t.uint32();
																	switch (a >>> 3) {
																		case 1:
																			o.device = t.string();
																			break;
																		case 2:
																			o.platform = t.string();
																			break;
																		case 3:
																			o.os = t.string();
																			break;
																		case 4:
																			o.version = t.string();
																			break;
																		default:
																			t.skipType(7 & a);
																	}
																}
																return o;
															}),
															(t.decodeDelimited = function (t) {
																return (
																	t instanceof r ||
																		(t = new r(t)),
																	this.decode(t, t.uint32())
																);
															}),
															(t.verify = function (t) {
																return 'object' !== typeof t ||
																	null === t
																	? 'object expected'
																	: null != t.device &&
																		  t.hasOwnProperty(
																				'device'
																		  ) &&
																		  !i.isString(t.device)
																		? 'device: string expected'
																		: null != t.platform &&
																			  t.hasOwnProperty(
																					'platform'
																			  ) &&
																			  !i.isString(
																					t.platform
																			  )
																			? 'platform: string expected'
																			: null != t.os &&
																				  t.hasOwnProperty(
																						'os'
																				  ) &&
																				  !i.isString(t.os)
																				? 'os: string expected'
																				: null !=
																							t.version &&
																					  t.hasOwnProperty(
																							'version'
																					  ) &&
																					  !i.isString(
																							t.version
																					  )
																					? 'version: string expected'
																					: null;
															}),
															(t.fromObject = function (t) {
																if (
																	t instanceof
																	c.atakmap.commoncommo.protobuf
																		.v1.Takv
																)
																	return t;
																var e =
																	new c.atakmap.commoncommo.protobuf.v1.Takv();
																return (
																	null != t.device &&
																		(e.device = String(
																			t.device
																		)),
																	null != t.platform &&
																		(e.platform = String(
																			t.platform
																		)),
																	null != t.os &&
																		(e.os = String(t.os)),
																	null != t.version &&
																		(e.version = String(
																			t.version
																		)),
																	e
																);
															}),
															(t.toObject = function (t, e) {
																e || (e = {});
																var n = {};
																return (
																	e.defaults &&
																		((n.device = ''),
																		(n.platform = ''),
																		(n.os = ''),
																		(n.version = '')),
																	null != t.device &&
																		t.hasOwnProperty(
																			'device'
																		) &&
																		(n.device = t.device),
																	null != t.platform &&
																		t.hasOwnProperty(
																			'platform'
																		) &&
																		(n.platform = t.platform),
																	null != t.os &&
																		t.hasOwnProperty('os') &&
																		(n.os = t.os),
																	null != t.version &&
																		t.hasOwnProperty(
																			'version'
																		) &&
																		(n.version = t.version),
																	n
																);
															}),
															(t.prototype.toJSON = function () {
																return this.constructor.toObject(
																	this,
																	o.util.toJSONOptions
																);
															}),
															t
														);
													})()),
													(t.Track = (function () {
														function t(t) {
															if (t)
																for (
																	var e = Object.keys(t), n = 0;
																	n < e.length;
																	++n
																)
																	null != t[e[n]] &&
																		(this[e[n]] = t[e[n]]);
														}
														return (
															(t.prototype.speed = 0),
															(t.prototype.course = 0),
															(t.create = function (e) {
																return new t(e);
															}),
															(t.encode = function (t, e) {
																return (
																	e || (e = a.create()),
																	null != t.speed &&
																		Object.hasOwnProperty.call(
																			t,
																			'speed'
																		) &&
																		e.uint32(9).double(t.speed),
																	null != t.course &&
																		Object.hasOwnProperty.call(
																			t,
																			'course'
																		) &&
																		e
																			.uint32(17)
																			.double(t.course),
																	e
																);
															}),
															(t.encodeDelimited = function (t, e) {
																return this.encode(t, e).ldelim();
															}),
															(t.decode = function (t, e) {
																t instanceof r || (t = r.create(t));
																for (
																	var n =
																			void 0 === e
																				? t.len
																				: t.pos + e,
																		o =
																			new c.atakmap.commoncommo.protobuf.v1.Track();
																	t.pos < n;

																) {
																	var a = t.uint32();
																	switch (a >>> 3) {
																		case 1:
																			o.speed = t.double();
																			break;
																		case 2:
																			o.course = t.double();
																			break;
																		default:
																			t.skipType(7 & a);
																	}
																}
																return o;
															}),
															(t.decodeDelimited = function (t) {
																return (
																	t instanceof r ||
																		(t = new r(t)),
																	this.decode(t, t.uint32())
																);
															}),
															(t.verify = function (t) {
																return 'object' !== typeof t ||
																	null === t
																	? 'object expected'
																	: null != t.speed &&
																		  t.hasOwnProperty(
																				'speed'
																		  ) &&
																		  'number' !==
																				typeof t.speed
																		? 'speed: number expected'
																		: null != t.course &&
																			  t.hasOwnProperty(
																					'course'
																			  ) &&
																			  'number' !==
																					typeof t.course
																			? 'course: number expected'
																			: null;
															}),
															(t.fromObject = function (t) {
																if (
																	t instanceof
																	c.atakmap.commoncommo.protobuf
																		.v1.Track
																)
																	return t;
																var e =
																	new c.atakmap.commoncommo.protobuf.v1.Track();
																return (
																	null != t.speed &&
																		(e.speed = Number(t.speed)),
																	null != t.course &&
																		(e.course = Number(
																			t.course
																		)),
																	e
																);
															}),
															(t.toObject = function (t, e) {
																e || (e = {});
																var n = {};
																return (
																	e.defaults &&
																		((n.speed = 0),
																		(n.course = 0)),
																	null != t.speed &&
																		t.hasOwnProperty('speed') &&
																		(n.speed =
																			e.json &&
																			!isFinite(t.speed)
																				? String(t.speed)
																				: t.speed),
																	null != t.course &&
																		t.hasOwnProperty(
																			'course'
																		) &&
																		(n.course =
																			e.json &&
																			!isFinite(t.course)
																				? String(t.course)
																				: t.course),
																	n
																);
															}),
															(t.prototype.toJSON = function () {
																return this.constructor.toObject(
																	this,
																	o.util.toJSONOptions
																);
															}),
															t
														);
													})()),
													(t.TakControl = (function () {
														function t(t) {
															if (t)
																for (
																	var e = Object.keys(t), n = 0;
																	n < e.length;
																	++n
																)
																	null != t[e[n]] &&
																		(this[e[n]] = t[e[n]]);
														}
														return (
															(t.prototype.minProtoVersion = 0),
															(t.prototype.maxProtoVersion = 0),
															(t.create = function (e) {
																return new t(e);
															}),
															(t.encode = function (t, e) {
																return (
																	e || (e = a.create()),
																	null != t.minProtoVersion &&
																		Object.hasOwnProperty.call(
																			t,
																			'minProtoVersion'
																		) &&
																		e
																			.uint32(8)
																			.uint32(
																				t.minProtoVersion
																			),
																	null != t.maxProtoVersion &&
																		Object.hasOwnProperty.call(
																			t,
																			'maxProtoVersion'
																		) &&
																		e
																			.uint32(16)
																			.uint32(
																				t.maxProtoVersion
																			),
																	e
																);
															}),
															(t.encodeDelimited = function (t, e) {
																return this.encode(t, e).ldelim();
															}),
															(t.decode = function (t, e) {
																t instanceof r || (t = r.create(t));
																for (
																	var n =
																			void 0 === e
																				? t.len
																				: t.pos + e,
																		o =
																			new c.atakmap.commoncommo.protobuf.v1.TakControl();
																	t.pos < n;

																) {
																	var a = t.uint32();
																	switch (a >>> 3) {
																		case 1:
																			o.minProtoVersion =
																				t.uint32();
																			break;
																		case 2:
																			o.maxProtoVersion =
																				t.uint32();
																			break;
																		default:
																			t.skipType(7 & a);
																	}
																}
																return o;
															}),
															(t.decodeDelimited = function (t) {
																return (
																	t instanceof r ||
																		(t = new r(t)),
																	this.decode(t, t.uint32())
																);
															}),
															(t.verify = function (t) {
																return 'object' !== typeof t ||
																	null === t
																	? 'object expected'
																	: null != t.minProtoVersion &&
																		  t.hasOwnProperty(
																				'minProtoVersion'
																		  ) &&
																		  !i.isInteger(
																				t.minProtoVersion
																		  )
																		? 'minProtoVersion: integer expected'
																		: null !=
																					t.maxProtoVersion &&
																			  t.hasOwnProperty(
																					'maxProtoVersion'
																			  ) &&
																			  !i.isInteger(
																					t.maxProtoVersion
																			  )
																			? 'maxProtoVersion: integer expected'
																			: null;
															}),
															(t.fromObject = function (t) {
																if (
																	t instanceof
																	c.atakmap.commoncommo.protobuf
																		.v1.TakControl
																)
																	return t;
																var e =
																	new c.atakmap.commoncommo.protobuf.v1.TakControl();
																return (
																	null != t.minProtoVersion &&
																		(e.minProtoVersion =
																			t.minProtoVersion >>>
																			0),
																	null != t.maxProtoVersion &&
																		(e.maxProtoVersion =
																			t.maxProtoVersion >>>
																			0),
																	e
																);
															}),
															(t.toObject = function (t, e) {
																e || (e = {});
																var n = {};
																return (
																	e.defaults &&
																		((n.minProtoVersion = 0),
																		(n.maxProtoVersion = 0)),
																	null != t.minProtoVersion &&
																		t.hasOwnProperty(
																			'minProtoVersion'
																		) &&
																		(n.minProtoVersion =
																			t.minProtoVersion),
																	null != t.maxProtoVersion &&
																		t.hasOwnProperty(
																			'maxProtoVersion'
																		) &&
																		(n.maxProtoVersion =
																			t.maxProtoVersion),
																	n
																);
															}),
															(t.prototype.toJSON = function () {
																return this.constructor.toObject(
																	this,
																	o.util.toJSONOptions
																);
															}),
															t
														);
													})()),
													(t.TakMessage = (function () {
														function t(t) {
															if (t)
																for (
																	var e = Object.keys(t), n = 0;
																	n < e.length;
																	++n
																)
																	null != t[e[n]] &&
																		(this[e[n]] = t[e[n]]);
														}
														return (
															(t.prototype.takControl = null),
															(t.prototype.cotEvent = null),
															(t.create = function (e) {
																return new t(e);
															}),
															(t.encode = function (t, e) {
																return (
																	e || (e = a.create()),
																	null != t.takControl &&
																		Object.hasOwnProperty.call(
																			t,
																			'takControl'
																		) &&
																		c.atakmap.commoncommo.protobuf.v1.TakControl.encode(
																			t.takControl,
																			e.uint32(10).fork()
																		).ldelim(),
																	null != t.cotEvent &&
																		Object.hasOwnProperty.call(
																			t,
																			'cotEvent'
																		) &&
																		c.atakmap.commoncommo.protobuf.v1.CotEvent.encode(
																			t.cotEvent,
																			e.uint32(18).fork()
																		).ldelim(),
																	e
																);
															}),
															(t.encodeDelimited = function (t, e) {
																return this.encode(t, e).ldelim();
															}),
															(t.decode = function (t, e) {
																t instanceof r || (t = r.create(t));
																for (
																	var n =
																			void 0 === e
																				? t.len
																				: t.pos + e,
																		o =
																			new c.atakmap.commoncommo.protobuf.v1.TakMessage();
																	t.pos < n;

																) {
																	var a = t.uint32();
																	switch (a >>> 3) {
																		case 1:
																			o.takControl =
																				c.atakmap.commoncommo.protobuf.v1.TakControl.decode(
																					t,
																					t.uint32()
																				);
																			break;
																		case 2:
																			o.cotEvent =
																				c.atakmap.commoncommo.protobuf.v1.CotEvent.decode(
																					t,
																					t.uint32()
																				);
																			break;
																		default:
																			t.skipType(7 & a);
																	}
																}
																return o;
															}),
															(t.decodeDelimited = function (t) {
																return (
																	t instanceof r ||
																		(t = new r(t)),
																	this.decode(t, t.uint32())
																);
															}),
															(t.verify = function (t) {
																if (
																	'object' !== typeof t ||
																	null === t
																)
																	return 'object expected';
																if (
																	null != t.takControl &&
																	t.hasOwnProperty('takControl')
																) {
																	var e =
																		c.atakmap.commoncommo.protobuf.v1.TakControl.verify(
																			t.takControl
																		);
																	if (e) return 'takControl.' + e;
																}
																if (
																	null != t.cotEvent &&
																	t.hasOwnProperty('cotEvent')
																) {
																	var n =
																		c.atakmap.commoncommo.protobuf.v1.CotEvent.verify(
																			t.cotEvent
																		);
																	if (n) return 'cotEvent.' + n;
																}
																return null;
															}),
															(t.fromObject = function (t) {
																if (
																	t instanceof
																	c.atakmap.commoncommo.protobuf
																		.v1.TakMessage
																)
																	return t;
																var e =
																	new c.atakmap.commoncommo.protobuf.v1.TakMessage();
																if (null != t.takControl) {
																	if (
																		'object' !==
																		typeof t.takControl
																	)
																		throw TypeError(
																			'.atakmap.commoncommo.protobuf.v1.TakMessage.takControl: object expected'
																		);
																	e.takControl =
																		c.atakmap.commoncommo.protobuf.v1.TakControl.fromObject(
																			t.takControl
																		);
																}
																if (null != t.cotEvent) {
																	if (
																		'object' !==
																		typeof t.cotEvent
																	)
																		throw TypeError(
																			'.atakmap.commoncommo.protobuf.v1.TakMessage.cotEvent: object expected'
																		);
																	e.cotEvent =
																		c.atakmap.commoncommo.protobuf.v1.CotEvent.fromObject(
																			t.cotEvent
																		);
																}
																return e;
															}),
															(t.toObject = function (t, e) {
																e || (e = {});
																var n = {};
																return (
																	e.defaults &&
																		((n.takControl = null),
																		(n.cotEvent = null)),
																	null != t.takControl &&
																		t.hasOwnProperty(
																			'takControl'
																		) &&
																		(n.takControl =
																			c.atakmap.commoncommo.protobuf.v1.TakControl.toObject(
																				t.takControl,
																				e
																			)),
																	null != t.cotEvent &&
																		t.hasOwnProperty(
																			'cotEvent'
																		) &&
																		(n.cotEvent =
																			c.atakmap.commoncommo.protobuf.v1.CotEvent.toObject(
																				t.cotEvent,
																				e
																			)),
																	n
																);
															}),
															(t.prototype.toJSON = function () {
																return this.constructor.toObject(
																	this,
																	o.util.toJSONOptions
																);
															}),
															t
														);
													})()),
													t
												);
											})()),
											t
										);
									})()),
									t
								);
							})()),
							t
						);
					})());
			},
			6771: function (t, e, n) {
				var o = n(85).default,
					r = n(5198).default,
					a = n(3772).default,
					i = n(2588).default,
					c = n(270).default,
					u = n(4564).default,
					l =
						(this && this.__importDefault) ||
						function (t) {
							return t && t.__esModule ? t : { default: t };
						};
				Object.defineProperty(e, '__esModule', { value: !0 });
				var s = n(515),
					p = l(n(6635)),
					f = n(9550);
				e.default = function (t, e, n) {
					return (
						Object.keys(t).forEach(function (t) {
							if (!f.isFunction(e[t]))
								throw new Error(
									'validatedRecordFactory parameter "propValidators" is missing required validator key "'.concat(
										t,
										'".'
									)
								);
						}),
						(function (t) {
							c(s, t);
							var l = u(s);
							function s(t) {
								return (
									o(this, s),
									Object.keys(e).forEach(function (o) {
										var r = t[o];
										if (!e[o](r))
											throw new p.default(
												''.concat(n, ' constructor'),
												'props.'.concat(o),
												''.concat(o, ' value')
											);
									}),
									l.call(this, t)
								);
							}
							return (
								r(s, [
									{
										key: 'get',
										value: function (t) {
											return a(i(s.prototype), 'get', this).call(this, t);
										}
									},
									{
										key: 'set',
										value: function (t, o) {
											if (e[t] && !e[t](o))
												throw new p.default(
													''.concat(n, '.set'),
													''.concat(String(t)),
													''.concat(String(t), ' value')
												);
											return a(i(s.prototype), 'set', this).call(this, t, o);
										}
									},
									{
										key: 'delete',
										value: function (t) {
											return a(i(s.prototype), 'delete', this).call(this, t);
										}
									}
								]),
								s
							);
						})(s.Record(t, n))
					);
				};
			},
			6098: function (t, e, n) {
				var o =
					(this && this.__importDefault) ||
					function (t) {
						return t && t.__esModule ? t : { default: t };
					};
				(Object.defineProperty(e, '__esModule', { value: !0 }),
					(e.isGroup =
						e.isContact =
						e.isCotEvent =
						e.isDetail =
						e.isMessageType =
						e.isTakMessage =
							void 0));
				var r = o(n(6173)),
					a = r.default.atakmap.commoncommo.protobuf.v1.TakMessage;
				function i(t) {
					return (
						!!t && null === t.xmlDetail && (null === t.xml || 'object' === typeof t.xml)
					);
				}
				function c(t) {
					return (
						!!t &&
						null === r.default.atakmap.commoncommo.protobuf.v1.CotEvent.verify(t) &&
						(null === t.detail || i(t.detail))
					);
				}
				((e.isTakMessage = function (t) {
					return !!t && null === a.verify(t) && c(t.cotEvent);
				}),
					(e.isMessageType = function (t) {
						return function (e) {
							return !!e && !!e.messageType && e.messageType === t;
						};
					}),
					(e.isDetail = i),
					(e.isCotEvent = c),
					(e.isContact = function (t) {
						return (
							!!t &&
							null === r.default.atakmap.commoncommo.protobuf.v1.Contact.verify(t)
						);
					}),
					(e.isGroup = function (t) {
						return (
							!!t &&
							null === r.default.atakmap.commoncommo.protobuf.v1.Group.verify(t)
						);
					}));
			}
		},
		e = {};
	function n(o) {
		var r = e[o];
		if (void 0 !== r) return r.exports;
		var a = (e[o] = { exports: {} });
		return (t[o].call(a.exports, a, a.exports, n), a.exports);
	}
	((n.m = t),
		(n.x = function () {
			var t = n.O(void 0, [755, 138, 478, 550], function () {
				return n(2548);
			});
			return (t = n.O(t));
		}),
		(function () {
			var t = [];
			n.O = function (e, o, r, a) {
				if (!o) {
					var i = 1 / 0;
					for (s = 0; s < t.length; s++) {
						((o = t[s][0]), (r = t[s][1]), (a = t[s][2]));
						for (var c = !0, u = 0; u < o.length; u++)
							(!1 & a || i >= a) &&
							Object.keys(n.O).every(function (t) {
								return n.O[t](o[u]);
							})
								? o.splice(u--, 1)
								: ((c = !1), a < i && (i = a));
						if (c) {
							t.splice(s--, 1);
							var l = r();
							void 0 !== l && (e = l);
						}
					}
					return e;
				}
				a = a || 0;
				for (var s = t.length; s > 0 && t[s - 1][2] > a; s--) t[s] = t[s - 1];
				t[s] = [o, r, a];
			};
		})(),
		(n.n = function (t) {
			var e =
				t && t.__esModule
					? function () {
							return t.default;
						}
					: function () {
							return t;
						};
			return (n.d(e, { a: e }), e);
		}),
		(n.d = function (t, e) {
			for (var o in e)
				n.o(e, o) &&
					!n.o(t, o) &&
					Object.defineProperty(t, o, { enumerable: !0, get: e[o] });
		}),
		(n.f = {}),
		(n.e = function (t) {
			return Promise.all(
				Object.keys(n.f).reduce(function (e, o) {
					return (n.f[o](t, e), e);
				}, [])
			);
		}),
		(n.u = function (t) {
			return (
				'static/js/' +
				t +
				'.' +
				{ 138: '6ad5e274', 478: '68e9e11a', 550: '9c0f43c2', 755: '8d15b362' }[t] +
				'.chunk.js'
			);
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
		(n.r = function (t) {
			('undefined' !== typeof Symbol &&
				Symbol.toStringTag &&
				Object.defineProperty(t, Symbol.toStringTag, { value: 'Module' }),
				Object.defineProperty(t, '__esModule', { value: !0 }));
		}),
		(function () {
			var t;
			n.g.importScripts && (t = n.g.location + '');
			var e = n.g.document;
			if (!t && e && (e.currentScript && (t = e.currentScript.src), !t)) {
				var o = e.getElementsByTagName('script');
				o.length && (t = o[o.length - 1].src);
			}
			if (!t) throw new Error('Automatic publicPath is not supported in this browser');
			((t = t
				.replace(/#.*$/, '')
				.replace(/\?.*$/, '')
				.replace(/\/[^\/]+$/, '/')),
				(n.p = t + '../../'));
		})(),
		(function () {
			var t = { 548: 1 };
			n.f.i = function (e, o) {
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
				o = e.push.bind(e);
			e.push = function (e) {
				var r = e[0],
					a = e[1],
					i = e[2];
				for (var c in a) n.o(a, c) && (n.m[c] = a[c]);
				for (i && i(n); r.length; ) t[r.pop()] = 1;
				o(e);
			};
		})(),
		(function () {
			var t = n.x;
			n.x = function () {
				return Promise.all([755, 138, 478, 550].map(n.e, n)).then(t);
			};
		})());
	n.x();
})();
