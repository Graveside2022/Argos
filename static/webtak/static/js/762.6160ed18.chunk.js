/*! For license information please see 762.6160ed18.chunk.js.LICENSE.txt */
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
	[762],
	{
		8884: function (e, t) {
			var r;
			!(function () {
				var i = (function () {
						var e = {
								defaultNoDataValue: -34027999387901484e22,
								decode: function (n, s) {
									var l =
											(s = s || {}).encodedMaskData ||
											null === s.encodedMaskData,
										f = a(n, s.inputOffset || 0, l),
										o =
											null !== s.noDataValue
												? s.noDataValue
												: e.defaultNoDataValue,
										u = t(
											f,
											s.pixelType || Float32Array,
											s.encodedMaskData,
											o,
											s.returnMask
										),
										d = {
											width: f.width,
											height: f.height,
											pixelData: u.resultPixels,
											minValue: u.minValue,
											maxValue: f.pixels.maxValue,
											noDataValue: o
										};
									return (
										u.resultMask && (d.maskData = u.resultMask),
										s.returnEncodedMask &&
											f.mask &&
											(d.encodedMaskData = f.mask.bitset
												? f.mask.bitset
												: null),
										s.returnFileInfo &&
											((d.fileInfo = r(f)),
											s.computeUsedBitDepths &&
												(d.fileInfo.bitDepths = i(f))),
										d
									);
								}
							},
							t = function (e, t, r, i, a) {
								var s,
									l,
									f,
									o = 0,
									u = e.pixels.numBlocksX,
									d = e.pixels.numBlocksY,
									c = Math.floor(e.width / u),
									h = Math.floor(e.height / d),
									m = 2 * e.maxZError,
									p = Number.MAX_VALUE;
								((r = r || (e.mask ? e.mask.bitset : null)),
									(l = new t(e.width * e.height)),
									a && r && (f = new Uint8Array(e.width * e.height)));
								for (var g, w, x = new Float32Array(c * h), k = 0; k <= d; k++) {
									var y = k !== d ? h : e.height % d;
									if (0 !== y)
										for (var b = 0; b <= u; b++) {
											var v = b !== u ? c : e.width % u;
											if (0 !== v) {
												var U,
													I,
													V,
													M,
													D = k * e.width * h + b * c,
													A = e.width - v,
													B = e.pixels.blocks[o];
												if (
													(B.encoding < 2
														? (0 === B.encoding
																? (U = B.rawData)
																: (n(
																		B.stuffedData,
																		B.bitsPerPixel,
																		B.numValidPixels,
																		B.offset,
																		m,
																		x,
																		e.pixels.maxValue
																	),
																	(U = x)),
															(I = 0))
														: (V = 2 === B.encoding ? 0 : B.offset),
													r)
												)
													for (w = 0; w < y; w++) {
														for (
															7 & D &&
																((M = r[D >> 3]), (M <<= 7 & D)),
																g = 0;
															g < v;
															g++
														)
															(7 & D || (M = r[D >> 3]),
																128 & M
																	? (f && (f[D] = 1),
																		(p =
																			p >
																			(s =
																				B.encoding < 2
																					? U[I++]
																					: V)
																				? s
																				: p),
																		(l[D++] = s))
																	: (f && (f[D] = 0),
																		(l[D++] = i)),
																(M <<= 1));
														D += A;
													}
												else if (B.encoding < 2)
													for (w = 0; w < y; w++) {
														for (g = 0; g < v; g++)
															((p = p > (s = U[I++]) ? s : p),
																(l[D++] = s));
														D += A;
													}
												else
													for (p = p > V ? V : p, w = 0; w < y; w++) {
														for (g = 0; g < v; g++) l[D++] = V;
														D += A;
													}
												if (1 === B.encoding && I !== B.numValidPixels)
													throw 'Block and Mask do not match';
												o++;
											}
										}
								}
								return { resultPixels: l, resultMask: f, minValue: p };
							},
							r = function (e) {
								return {
									fileIdentifierString: e.fileIdentifierString,
									fileVersion: e.fileVersion,
									imageType: e.imageType,
									height: e.height,
									width: e.width,
									maxZError: e.maxZError,
									eofOffset: e.eofOffset,
									mask: e.mask
										? {
												numBlocksX: e.mask.numBlocksX,
												numBlocksY: e.mask.numBlocksY,
												numBytes: e.mask.numBytes,
												maxValue: e.mask.maxValue
											}
										: null,
									pixels: {
										numBlocksX: e.pixels.numBlocksX,
										numBlocksY: e.pixels.numBlocksY,
										numBytes: e.pixels.numBytes,
										maxValue: e.pixels.maxValue,
										noDataValue: e.noDataValue
									}
								};
							},
							i = function (e) {
								for (
									var t = e.pixels.numBlocksX * e.pixels.numBlocksY,
										r = {},
										i = 0;
									i < t;
									i++
								) {
									var a = e.pixels.blocks[i];
									0 === a.encoding
										? (r.float32 = !0)
										: 1 === a.encoding
											? (r[a.bitsPerPixel] = !0)
											: (r[0] = !0);
								}
								return Object.keys(r);
							},
							a = function (e, t, r) {
								var i = {},
									a = new Uint8Array(e, t, 10);
								if (
									((i.fileIdentifierString = String.fromCharCode.apply(null, a)),
									'CntZImage' !== i.fileIdentifierString.trim())
								)
									throw (
										'Unexpected file identifier string: ' +
										i.fileIdentifierString
									);
								t += 10;
								var n = new DataView(e, t, 24);
								if (
									((i.fileVersion = n.getInt32(0, !0)),
									(i.imageType = n.getInt32(4, !0)),
									(i.height = n.getUint32(8, !0)),
									(i.width = n.getUint32(12, !0)),
									(i.maxZError = n.getFloat64(16, !0)),
									(t += 24),
									!r)
								)
									if (
										((n = new DataView(e, t, 16)),
										(i.mask = {}),
										(i.mask.numBlocksY = n.getUint32(0, !0)),
										(i.mask.numBlocksX = n.getUint32(4, !0)),
										(i.mask.numBytes = n.getUint32(8, !0)),
										(i.mask.maxValue = n.getFloat32(12, !0)),
										(t += 16),
										i.mask.numBytes > 0)
									) {
										var s = new Uint8Array(Math.ceil((i.width * i.height) / 8)),
											l = (n = new DataView(e, t, i.mask.numBytes)).getInt16(
												0,
												!0
											),
											f = 2,
											o = 0;
										do {
											if (l > 0) for (; l--; ) s[o++] = n.getUint8(f++);
											else {
												var u = n.getUint8(f++);
												for (l = -l; l--; ) s[o++] = u;
											}
											((l = n.getInt16(f, !0)), (f += 2));
										} while (f < i.mask.numBytes);
										if (-32768 !== l || o < s.length)
											throw 'Unexpected end of mask RLE encoding';
										((i.mask.bitset = s), (t += i.mask.numBytes));
									} else
										0 ===
											(i.mask.numBytes |
												i.mask.numBlocksY |
												i.mask.maxValue) &&
											(i.mask.bitset = new Uint8Array(
												Math.ceil((i.width * i.height) / 8)
											));
								((n = new DataView(e, t, 16)),
									(i.pixels = {}),
									(i.pixels.numBlocksY = n.getUint32(0, !0)),
									(i.pixels.numBlocksX = n.getUint32(4, !0)),
									(i.pixels.numBytes = n.getUint32(8, !0)),
									(i.pixels.maxValue = n.getFloat32(12, !0)),
									(t += 16));
								var d = i.pixels.numBlocksX,
									c = i.pixels.numBlocksY,
									h = d + (i.width % d > 0 ? 1 : 0),
									m = c + (i.height % c > 0 ? 1 : 0);
								i.pixels.blocks = new Array(h * m);
								for (var p = 0, g = 0; g < m; g++)
									for (var w = 0; w < h; w++) {
										var x = 0,
											k = e.byteLength - t;
										n = new DataView(e, t, Math.min(10, k));
										var y = {};
										i.pixels.blocks[p++] = y;
										var b = n.getUint8(0);
										if ((x++, (y.encoding = 63 & b), y.encoding > 3))
											throw 'Invalid block encoding (' + y.encoding + ')';
										if (2 !== y.encoding) {
											if (0 !== b && 2 !== b) {
												if (((b >>= 6), (y.offsetType = b), 2 === b))
													((y.offset = n.getInt8(1)), x++);
												else if (1 === b)
													((y.offset = n.getInt16(1, !0)), (x += 2));
												else {
													if (0 !== b) throw 'Invalid block offset type';
													((y.offset = n.getFloat32(1, !0)), (x += 4));
												}
												if (1 === y.encoding)
													if (
														((b = n.getUint8(x)),
														x++,
														(y.bitsPerPixel = 63 & b),
														(b >>= 6),
														(y.numValidPixelsType = b),
														2 === b)
													)
														((y.numValidPixels = n.getUint8(x)), x++);
													else if (1 === b)
														((y.numValidPixels = n.getUint16(x, !0)),
															(x += 2));
													else {
														if (0 !== b)
															throw 'Invalid valid pixel count type';
														((y.numValidPixels = n.getUint32(x, !0)),
															(x += 4));
													}
											}
											var v;
											if (((t += x), 3 !== y.encoding))
												if (0 === y.encoding) {
													var U = (i.pixels.numBytes - 1) / 4;
													if (U !== Math.floor(U))
														throw 'uncompressed block has invalid length';
													((v = new ArrayBuffer(4 * U)),
														new Uint8Array(v).set(
															new Uint8Array(e, t, 4 * U)
														));
													var I = new Float32Array(v);
													((y.rawData = I), (t += 4 * U));
												} else if (1 === y.encoding) {
													var V = Math.ceil(
															(y.numValidPixels * y.bitsPerPixel) / 8
														),
														M = Math.ceil(V / 4);
													((v = new ArrayBuffer(4 * M)),
														new Uint8Array(v).set(
															new Uint8Array(e, t, V)
														),
														(y.stuffedData = new Uint32Array(v)),
														(t += V));
												}
										} else t++;
									}
								return ((i.eofOffset = t), i);
							},
							n = function (e, t, r, i, a, n, s) {
								var l,
									f,
									o,
									u = (1 << t) - 1,
									d = 0,
									c = 0,
									h = Math.ceil((s - i) / a),
									m = 4 * e.length - Math.ceil((t * r) / 8);
								for (e[e.length - 1] <<= 8 * m, l = 0; l < r; l++) {
									if ((0 === c && ((o = e[d++]), (c = 32)), c >= t))
										((f = (o >>> (c - t)) & u), (c -= t));
									else {
										var p = t - c;
										((f = ((o & u) << p) & u),
											(f += (o = e[d++]) >>> (c = 32 - p)));
									}
									n[l] = f < h ? i + f * a : s;
								}
								return n;
							};
						return e;
					})(),
					a = (function () {
						'use strict';
						var e = function (e, t, r, i, a, n, s, l) {
								var f,
									o,
									u,
									d,
									c,
									h = (1 << r) - 1,
									m = 0,
									p = 0,
									g = 4 * e.length - Math.ceil((r * i) / 8);
								if (((e[e.length - 1] <<= 8 * g), a))
									for (f = 0; f < i; f++)
										(0 === p && ((u = e[m++]), (p = 32)),
											p >= r
												? ((o = (u >>> (p - r)) & h), (p -= r))
												: ((o = ((u & h) << (d = r - p)) & h),
													(o += (u = e[m++]) >>> (p = 32 - d))),
											(t[f] = a[o]));
								else
									for (c = Math.ceil((l - n) / s), f = 0; f < i; f++)
										(0 === p && ((u = e[m++]), (p = 32)),
											p >= r
												? ((o = (u >>> (p - r)) & h), (p -= r))
												: ((o = ((u & h) << (d = r - p)) & h),
													(o += (u = e[m++]) >>> (p = 32 - d))),
											(t[f] = o < c ? n + o * s : l));
							},
							t = function (e, t, r, i, a, n) {
								var s,
									l = (1 << t) - 1,
									f = 0,
									o = 0,
									u = 0,
									d = 0,
									c = 0,
									h = [],
									m = 4 * e.length - Math.ceil((t * r) / 8);
								e[e.length - 1] <<= 8 * m;
								var p = Math.ceil((n - i) / a);
								for (o = 0; o < r; o++)
									(0 === d && ((s = e[f++]), (d = 32)),
										d >= t
											? ((c = (s >>> (d - t)) & l), (d -= t))
											: ((c = ((s & l) << (u = t - d)) & l),
												(c += (s = e[f++]) >>> (d = 32 - u))),
										(h[o] = c < p ? i + c * a : n));
								return (h.unshift(i), h);
							},
							r = function (e, t, r, i, a, n, s, l) {
								var f,
									o,
									u,
									d,
									c = (1 << r) - 1,
									h = 0,
									m = 0,
									p = 0;
								if (a)
									for (f = 0; f < i; f++)
										(0 === m && ((u = e[h++]), (m = 32), (p = 0)),
											m >= r
												? ((o = (u >>> p) & c), (m -= r), (p += r))
												: ((o = (u >>> p) & c),
													(m = 32 - (d = r - m)),
													(o |=
														((u = e[h++]) & ((1 << d) - 1)) << (r - d)),
													(p = d)),
											(t[f] = a[o]));
								else {
									var g = Math.ceil((l - n) / s);
									for (f = 0; f < i; f++)
										(0 === m && ((u = e[h++]), (m = 32), (p = 0)),
											m >= r
												? ((o = (u >>> p) & c), (m -= r), (p += r))
												: ((o = (u >>> p) & c),
													(m = 32 - (d = r - m)),
													(o |=
														((u = e[h++]) & ((1 << d) - 1)) << (r - d)),
													(p = d)),
											(t[f] = o < g ? n + o * s : l));
								}
								return t;
							},
							i = function (e, t, r, i, a, n) {
								var s,
									l = (1 << t) - 1,
									f = 0,
									o = 0,
									u = 0,
									d = 0,
									c = 0,
									h = 0,
									m = [],
									p = Math.ceil((n - i) / a);
								for (o = 0; o < r; o++)
									(0 === d && ((s = e[f++]), (d = 32), (h = 0)),
										d >= t
											? ((c = (s >>> h) & l), (d -= t), (h += t))
											: ((c = (s >>> h) & l),
												(d = 32 - (u = t - d)),
												(c |= ((s = e[f++]) & ((1 << u) - 1)) << (t - u)),
												(h = u)),
										(m[o] = c < p ? i + c * a : n));
								return (m.unshift(i), m);
							},
							a = function (e, t, r, i) {
								var a,
									n,
									s,
									l,
									f = (1 << r) - 1,
									o = 0,
									u = 0,
									d = 4 * e.length - Math.ceil((r * i) / 8);
								for (e[e.length - 1] <<= 8 * d, a = 0; a < i; a++)
									(0 === u && ((s = e[o++]), (u = 32)),
										u >= r
											? ((n = (s >>> (u - r)) & f), (u -= r))
											: ((n = ((s & f) << (l = r - u)) & f),
												(n += (s = e[o++]) >>> (u = 32 - l))),
										(t[a] = n));
								return t;
							},
							n = function (e, t, r, i) {
								var a,
									n,
									s,
									l,
									f = (1 << r) - 1,
									o = 0,
									u = 0,
									d = 0;
								for (a = 0; a < i; a++)
									(0 === u && ((s = e[o++]), (u = 32), (d = 0)),
										u >= r
											? ((n = (s >>> d) & f), (u -= r), (d += r))
											: ((n = (s >>> d) & f),
												(u = 32 - (l = r - u)),
												(n |= ((s = e[o++]) & ((1 << l) - 1)) << (r - l)),
												(d = l)),
										(t[a] = n));
								return t;
							},
							s = {
								HUFFMAN_LUT_BITS_MAX: 12,
								computeChecksumFletcher32: function (e) {
									for (
										var t = 65535,
											r = 65535,
											i = e.length,
											a = Math.floor(i / 2),
											n = 0;
										a;

									) {
										var s = a >= 359 ? 359 : a;
										a -= s;
										do {
											((t += e[n++] << 8), (r += t += e[n++]));
										} while (--s);
										((t = (65535 & t) + (t >>> 16)),
											(r = (65535 & r) + (r >>> 16)));
									}
									return (
										1 & i && (r += t += e[n] << 8),
										(((r = (65535 & r) + (r >>> 16)) << 16) |
											(t = (65535 & t) + (t >>> 16))) >>>
											0
									);
								},
								readHeaderInfo: function (e, t) {
									var r = t.ptr,
										i = new Uint8Array(e, r, 6),
										a = {};
									if (
										((a.fileIdentifierString = String.fromCharCode.apply(
											null,
											i
										)),
										0 !== a.fileIdentifierString.lastIndexOf('Lerc2', 0))
									)
										throw (
											'Unexpected file identifier string (expect Lerc2 ): ' +
											a.fileIdentifierString
										);
									r += 6;
									var n,
										s = new DataView(e, r, 8),
										l = s.getInt32(0, !0);
									if (
										((a.fileVersion = l),
										(r += 4),
										l >= 3 && ((a.checksum = s.getUint32(4, !0)), (r += 4)),
										(s = new DataView(e, r, 12)),
										(a.height = s.getUint32(0, !0)),
										(a.width = s.getUint32(4, !0)),
										(r += 8),
										l >= 4
											? ((a.numDims = s.getUint32(8, !0)), (r += 4))
											: (a.numDims = 1),
										(s = new DataView(e, r, 40)),
										(a.numValidPixel = s.getUint32(0, !0)),
										(a.microBlockSize = s.getInt32(4, !0)),
										(a.blobSize = s.getInt32(8, !0)),
										(a.imageType = s.getInt32(12, !0)),
										(a.maxZError = s.getFloat64(16, !0)),
										(a.zMin = s.getFloat64(24, !0)),
										(a.zMax = s.getFloat64(32, !0)),
										(r += 40),
										(t.headerInfo = a),
										(t.ptr = r),
										l >= 3 &&
											((n = l >= 4 ? 52 : 48),
											this.computeChecksumFletcher32(
												new Uint8Array(e, r - n, a.blobSize - 14)
											) !== a.checksum))
									)
										throw 'Checksum failed.';
									return !0;
								},
								checkMinMaxRanges: function (e, t) {
									var r = t.headerInfo,
										i = this.getDataTypeArray(r.imageType),
										a = r.numDims * this.getDataTypeSize(r.imageType),
										n = this.readSubArray(e, t.ptr, i, a),
										s = this.readSubArray(e, t.ptr + a, i, a);
									t.ptr += 2 * a;
									var l,
										f = !0;
									for (l = 0; l < r.numDims; l++)
										if (n[l] !== s[l]) {
											f = !1;
											break;
										}
									return ((r.minValues = n), (r.maxValues = s), f);
								},
								readSubArray: function (e, t, r, i) {
									var a;
									if (r === Uint8Array) a = new Uint8Array(e, t, i);
									else {
										var n = new ArrayBuffer(i);
										(new Uint8Array(n).set(new Uint8Array(e, t, i)),
											(a = new r(n)));
									}
									return a;
								},
								readMask: function (e, t) {
									var r,
										i,
										a = t.ptr,
										n = t.headerInfo,
										s = n.width * n.height,
										l = n.numValidPixel,
										f = new DataView(e, a, 4),
										o = {};
									if (
										((o.numBytes = f.getUint32(0, !0)),
										(a += 4),
										(0 === l || s === l) && 0 !== o.numBytes)
									)
										throw 'invalid mask';
									if (0 === l)
										((r = new Uint8Array(Math.ceil(s / 8))),
											(o.bitset = r),
											(i = new Uint8Array(s)),
											(t.pixels.resultMask = i),
											(a += o.numBytes));
									else if (o.numBytes > 0) {
										r = new Uint8Array(Math.ceil(s / 8));
										var u = (f = new DataView(e, a, o.numBytes)).getInt16(
												0,
												!0
											),
											d = 2,
											c = 0,
											h = 0;
										do {
											if (u > 0) for (; u--; ) r[c++] = f.getUint8(d++);
											else
												for (h = f.getUint8(d++), u = -u; u--; ) r[c++] = h;
											((u = f.getInt16(d, !0)), (d += 2));
										} while (d < o.numBytes);
										if (-32768 !== u || c < r.length)
											throw 'Unexpected end of mask RLE encoding';
										i = new Uint8Array(s);
										var m = 0,
											p = 0;
										for (p = 0; p < s; p++)
											(7 & p
												? ((m = r[p >> 3]), (m <<= 7 & p))
												: (m = r[p >> 3]),
												128 & m && (i[p] = 1));
										((t.pixels.resultMask = i),
											(o.bitset = r),
											(a += o.numBytes));
									}
									return ((t.ptr = a), (t.mask = o), !0);
								},
								readDataOneSweep: function (e, t, r, i) {
									var a,
										n = t.ptr,
										l = t.headerInfo,
										f = l.numDims,
										o = l.width * l.height,
										u = l.imageType,
										d = l.numValidPixel * s.getDataTypeSize(u) * f,
										c = t.pixels.resultMask;
									if (r === Uint8Array) a = new Uint8Array(e, n, d);
									else {
										var h = new ArrayBuffer(d);
										(new Uint8Array(h).set(new Uint8Array(e, n, d)),
											(a = new r(h)));
									}
									if (a.length === o * f)
										t.pixels.resultPixels = i
											? s.swapDimensionOrder(a, o, f, r, !0)
											: a;
									else {
										t.pixels.resultPixels = new r(o * f);
										var m = 0,
											p = 0,
											g = 0,
											w = 0;
										if (f > 1) {
											if (i) {
												for (p = 0; p < o; p++)
													if (c[p])
														for (w = p, g = 0; g < f; g++, w += o)
															t.pixels.resultPixels[w] = a[m++];
											} else
												for (p = 0; p < o; p++)
													if (c[p])
														for (w = p * f, g = 0; g < f; g++)
															t.pixels.resultPixels[w + g] = a[m++];
										} else
											for (p = 0; p < o; p++)
												c[p] && (t.pixels.resultPixels[p] = a[m++]);
									}
									return ((n += d), (t.ptr = n), !0);
								},
								readHuffmanTree: function (e, t) {
									var r = this.HUFFMAN_LUT_BITS_MAX,
										i = new DataView(e, t.ptr, 16);
									if (((t.ptr += 16), i.getInt32(0, !0) < 2))
										throw 'unsupported Huffman version';
									var a = i.getInt32(4, !0),
										n = i.getInt32(8, !0),
										f = i.getInt32(12, !0);
									if (n >= f) return !1;
									var o = new Uint32Array(f - n);
									s.decodeBits(e, t, o);
									var u,
										d,
										c,
										h,
										m = [];
									for (u = n; u < f; u++)
										m[(d = u - (u < a ? 0 : a))] = {
											first: o[u - n],
											second: null
										};
									var p = e.byteLength - t.ptr,
										g = Math.ceil(p / 4),
										w = new ArrayBuffer(4 * g);
									new Uint8Array(w).set(new Uint8Array(e, t.ptr, p));
									var x,
										k = new Uint32Array(w),
										y = 0,
										b = 0;
									for (x = k[0], u = n; u < f; u++)
										(h = m[(d = u - (u < a ? 0 : a))].first) > 0 &&
											((m[d].second = (x << y) >>> (32 - h)),
											32 - y >= h
												? 32 === (y += h) && ((y = 0), (x = k[++b]))
												: ((y += h - 32),
													(x = k[++b]),
													(m[d].second |= x >>> (32 - y))));
									var v = 0,
										U = 0,
										I = new l();
									for (u = 0; u < m.length; u++)
										void 0 !== m[u] && (v = Math.max(v, m[u].first));
									U = v >= r ? r : v;
									var V,
										M,
										D,
										A,
										B,
										P = [];
									for (u = n; u < f; u++)
										if ((h = m[(d = u - (u < a ? 0 : a))].first) > 0)
											if (((V = [h, d]), h <= U))
												for (
													M = m[d].second << (U - h),
														D = 1 << (U - h),
														c = 0;
													c < D;
													c++
												)
													P[M | c] = V;
											else
												for (M = m[d].second, B = I, A = h - 1; A >= 0; A--)
													((M >>> A) & 1
														? (B.right || (B.right = new l()),
															(B = B.right))
														: (B.left || (B.left = new l()),
															(B = B.left)),
														0 !== A || B.val || (B.val = V[1]));
									return {
										decodeLut: P,
										numBitsLUTQick: U,
										numBitsLUT: v,
										tree: I,
										stuffedData: k,
										srcPtr: b,
										bitPos: y
									};
								},
								readHuffman: function (e, t, r, i) {
									var a,
										n,
										l,
										f,
										o,
										u,
										d,
										c,
										h,
										m = t.headerInfo.numDims,
										p = t.headerInfo.height,
										g = t.headerInfo.width,
										w = g * p,
										x = this.readHuffmanTree(e, t),
										k = x.decodeLut,
										y = x.tree,
										b = x.stuffedData,
										v = x.srcPtr,
										U = x.bitPos,
										I = x.numBitsLUTQick,
										V = x.numBitsLUT,
										M = 0 === t.headerInfo.imageType ? 128 : 0,
										D = t.pixels.resultMask,
										A = 0;
									U > 0 && (v++, (U = 0));
									var B,
										P = b[v],
										T = 1 === t.encodeMode,
										S = new r(w * m),
										z = S;
									if (m < 2 || T) {
										for (B = 0; B < m; B++)
											if (
												(m > 1 &&
													((z = new r(S.buffer, w * B, w)), (A = 0)),
												t.headerInfo.numValidPixel === g * p)
											)
												for (c = 0, u = 0; u < p; u++)
													for (d = 0; d < g; d++, c++) {
														if (
															((n = 0),
															(o = f = (P << U) >>> (32 - I)),
															32 - U < I &&
																(o = f |=
																	b[v + 1] >>> (64 - U - I)),
															k[o])
														)
															((n = k[o][1]), (U += k[o][0]));
														else
															for (
																o = f = (P << U) >>> (32 - V),
																	32 - U < V &&
																		(o = f |=
																			b[v + 1] >>>
																			(64 - U - V)),
																	a = y,
																	h = 0;
																h < V;
																h++
															)
																if (
																	!(a =
																		(f >>> (V - h - 1)) & 1
																			? a.right
																			: a.left).left &&
																	!a.right
																) {
																	((n = a.val), (U = U + h + 1));
																	break;
																}
														(U >= 32 && ((U -= 32), (P = b[++v])),
															(l = n - M),
															T
																? ((l +=
																		d > 0
																			? A
																			: u > 0
																				? z[c - g]
																				: A),
																	(l &= 255),
																	(z[c] = l),
																	(A = l))
																: (z[c] = l));
													}
											else
												for (c = 0, u = 0; u < p; u++)
													for (d = 0; d < g; d++, c++)
														if (D[c]) {
															if (
																((n = 0),
																(o = f = (P << U) >>> (32 - I)),
																32 - U < I &&
																	(o = f |=
																		b[v + 1] >>> (64 - U - I)),
																k[o])
															)
																((n = k[o][1]), (U += k[o][0]));
															else
																for (
																	o = f = (P << U) >>> (32 - V),
																		32 - U < V &&
																			(o = f |=
																				b[v + 1] >>>
																				(64 - U - V)),
																		a = y,
																		h = 0;
																	h < V;
																	h++
																)
																	if (
																		!(a =
																			(f >>> (V - h - 1)) & 1
																				? a.right
																				: a.left).left &&
																		!a.right
																	) {
																		((n = a.val),
																			(U = U + h + 1));
																		break;
																	}
															(U >= 32 && ((U -= 32), (P = b[++v])),
																(l = n - M),
																T
																	? (d > 0 && D[c - 1]
																			? (l += A)
																			: u > 0 && D[c - g]
																				? (l += z[c - g])
																				: (l += A),
																		(l &= 255),
																		(z[c] = l),
																		(A = l))
																	: (z[c] = l));
														}
									} else
										for (c = 0, u = 0; u < p; u++)
											for (d = 0; d < g; d++)
												if (((c = u * g + d), !D || D[c]))
													for (B = 0; B < m; B++, c += w) {
														if (
															((n = 0),
															(o = f = (P << U) >>> (32 - I)),
															32 - U < I &&
																(o = f |=
																	b[v + 1] >>> (64 - U - I)),
															k[o])
														)
															((n = k[o][1]), (U += k[o][0]));
														else
															for (
																o = f = (P << U) >>> (32 - V),
																	32 - U < V &&
																		(o = f |=
																			b[v + 1] >>>
																			(64 - U - V)),
																	a = y,
																	h = 0;
																h < V;
																h++
															)
																if (
																	!(a =
																		(f >>> (V - h - 1)) & 1
																			? a.right
																			: a.left).left &&
																	!a.right
																) {
																	((n = a.val), (U = U + h + 1));
																	break;
																}
														(U >= 32 && ((U -= 32), (P = b[++v])),
															(l = n - M),
															(z[c] = l));
													}
									((t.ptr = t.ptr + 4 * (v + 1) + (U > 0 ? 4 : 0)),
										(t.pixels.resultPixels = S),
										m > 1 &&
											!i &&
											(t.pixels.resultPixels = s.swapDimensionOrder(
												S,
												w,
												m,
												r
											)));
								},
								decodeBits: function (s, l, f, o, u) {
									var d = l.headerInfo,
										c = d.fileVersion,
										h = 0,
										m = s.byteLength - l.ptr >= 5 ? 5 : s.byteLength - l.ptr,
										p = new DataView(s, l.ptr, m),
										g = p.getUint8(0);
									h++;
									var w = g >> 6,
										x = 0 === w ? 4 : 3 - w,
										k = (32 & g) > 0,
										y = 31 & g,
										b = 0;
									if (1 === x) ((b = p.getUint8(h)), h++);
									else if (2 === x) ((b = p.getUint16(h, !0)), (h += 2));
									else {
										if (4 !== x) throw 'Invalid valid pixel count type';
										((b = p.getUint32(h, !0)), (h += 4));
									}
									var v,
										U,
										I,
										V,
										M,
										D,
										A,
										B,
										P,
										T = 2 * d.maxZError,
										S = d.numDims > 1 ? d.maxValues[u] : d.zMax;
									if (k) {
										for (
											l.counter.lut++,
												B = p.getUint8(h),
												y,
												h++,
												V = Math.ceil(((B - 1) * y) / 8),
												M = Math.ceil(V / 4),
												U = new ArrayBuffer(4 * M),
												I = new Uint8Array(U),
												l.ptr += h,
												I.set(new Uint8Array(s, l.ptr, V)),
												A = new Uint32Array(U),
												l.ptr += V,
												P = 0;
											(B - 1) >>> P;

										)
											P++;
										((V = Math.ceil((b * P) / 8)),
											(M = Math.ceil(V / 4)),
											(U = new ArrayBuffer(4 * M)),
											(I = new Uint8Array(U)).set(
												new Uint8Array(s, l.ptr, V)
											),
											(v = new Uint32Array(U)),
											(l.ptr += V),
											(D =
												c >= 3
													? i(A, y, B - 1, o, T, S)
													: t(A, y, B - 1, o, T, S)),
											c >= 3 ? r(v, f, P, b, D) : e(v, f, P, b, D));
									} else
										(l.counter.bitstuffer++,
											(P = y),
											(l.ptr += h),
											P > 0 &&
												((V = Math.ceil((b * P) / 8)),
												(M = Math.ceil(V / 4)),
												(U = new ArrayBuffer(4 * M)),
												(I = new Uint8Array(U)).set(
													new Uint8Array(s, l.ptr, V)
												),
												(v = new Uint32Array(U)),
												(l.ptr += V),
												c >= 3
													? null == o
														? n(v, f, P, b)
														: r(v, f, P, b, !1, o, T, S)
													: null == o
														? a(v, f, P, b)
														: e(v, f, P, b, !1, o, T, S)));
								},
								readTiles: function (e, t, r, i) {
									var a = t.headerInfo,
										n = a.width,
										l = a.height,
										f = n * l,
										o = a.microBlockSize,
										u = a.imageType,
										d = s.getDataTypeSize(u),
										c = Math.ceil(n / o),
										h = Math.ceil(l / o);
									((t.pixels.numBlocksY = h),
										(t.pixels.numBlocksX = c),
										(t.pixels.ptr = 0));
									var m,
										p,
										g,
										w,
										x,
										k,
										y,
										b,
										v,
										U,
										I = 0,
										V = 0,
										M = 0,
										D = 0,
										A = 0,
										B = 0,
										P = 0,
										T = 0,
										S = 0,
										z = 0,
										C = 0,
										F = 0,
										O = 0,
										L = 0,
										E = 0,
										Z = new r(o * o),
										X = l % o || o,
										Y = n % o || o,
										H = a.numDims,
										_ = t.pixels.resultMask,
										N = t.pixels.resultPixels,
										R = a.fileVersion >= 5 ? 14 : 15,
										Q = a.zMax;
									for (M = 0; M < h; M++)
										for (A = M !== h - 1 ? o : X, D = 0; D < c; D++)
											for (
												z = M * n * o + D * o,
													C = n - (B = D !== c - 1 ? o : Y),
													b = 0;
												b < H;
												b++
											) {
												if (
													(H > 1
														? ((U = N),
															(z = M * n * o + D * o),
															(N = new r(
																t.pixels.resultPixels.buffer,
																f * b * d,
																f
															)),
															(Q = a.maxValues[b]))
														: (U = null),
													(P = e.byteLength - t.ptr),
													(p = {}),
													(E = 0),
													(T = (m = new DataView(
														e,
														t.ptr,
														Math.min(10, P)
													)).getUint8(0)),
													E++,
													(v = a.fileVersion >= 5 ? 4 & T : 0),
													(S = (T >> 6) & 255),
													((T >> 2) & R) !== (((D * o) >> 3) & R))
												)
													throw 'integrity issue';
												if (v && 0 === b) throw 'integrity issue';
												if ((x = 3 & T) > 3)
													throw (
														(t.ptr += E),
														'Invalid block encoding (' + x + ')'
													);
												if (2 !== x)
													if (0 === x) {
														if (v) throw 'integrity issue';
														if (
															(t.counter.uncompressed++,
															(t.ptr += E),
															(F =
																(F = A * B * d) <
																(O = e.byteLength - t.ptr)
																	? F
																	: O),
															(g = new ArrayBuffer(
																F % d === 0 ? F : F + d - (F % d)
															)),
															new Uint8Array(g).set(
																new Uint8Array(e, t.ptr, F)
															),
															(w = new r(g)),
															(L = 0),
															_)
														)
															for (I = 0; I < A; I++) {
																for (V = 0; V < B; V++)
																	(_[z] && (N[z] = w[L++]), z++);
																z += C;
															}
														else
															for (I = 0; I < A; I++) {
																for (V = 0; V < B; V++)
																	N[z++] = w[L++];
																z += C;
															}
														t.ptr += L * d;
													} else if (
														((k = s.getDataTypeUsed(
															v && u < 6 ? 4 : u,
															S
														)),
														(y = s.getOnePixel(p, E, k, m)),
														(E += s.getDataTypeSize(k)),
														3 === x)
													)
														if (
															((t.ptr += E),
															t.counter.constantoffset++,
															_)
														)
															for (I = 0; I < A; I++) {
																for (V = 0; V < B; V++)
																	(_[z] &&
																		(N[z] = v
																			? Math.min(Q, U[z] + y)
																			: y),
																		z++);
																z += C;
															}
														else
															for (I = 0; I < A; I++) {
																for (V = 0; V < B; V++)
																	((N[z] = v
																		? Math.min(Q, U[z] + y)
																		: y),
																		z++);
																z += C;
															}
													else if (
														((t.ptr += E),
														s.decodeBits(e, t, Z, y, b),
														(E = 0),
														v)
													)
														if (_)
															for (I = 0; I < A; I++) {
																for (V = 0; V < B; V++)
																	(_[z] && (N[z] = Z[E++] + U[z]),
																		z++);
																z += C;
															}
														else
															for (I = 0; I < A; I++) {
																for (V = 0; V < B; V++)
																	((N[z] = Z[E++] + U[z]), z++);
																z += C;
															}
													else if (_)
														for (I = 0; I < A; I++) {
															for (V = 0; V < B; V++)
																(_[z] && (N[z] = Z[E++]), z++);
															z += C;
														}
													else
														for (I = 0; I < A; I++) {
															for (V = 0; V < B; V++) N[z++] = Z[E++];
															z += C;
														}
												else {
													if (v)
														if (_)
															for (I = 0; I < A; I++)
																for (V = 0; V < B; V++)
																	(_[z] && (N[z] = U[z]), z++);
														else
															for (I = 0; I < A; I++)
																for (V = 0; V < B; V++)
																	((N[z] = U[z]), z++);
													(t.counter.constant++, (t.ptr += E));
												}
											}
									H > 1 &&
										!i &&
										(t.pixels.resultPixels = s.swapDimensionOrder(
											t.pixels.resultPixels,
											f,
											H,
											r
										));
								},
								formatFileInfo: function (e) {
									return {
										fileIdentifierString: e.headerInfo.fileIdentifierString,
										fileVersion: e.headerInfo.fileVersion,
										imageType: e.headerInfo.imageType,
										height: e.headerInfo.height,
										width: e.headerInfo.width,
										numValidPixel: e.headerInfo.numValidPixel,
										microBlockSize: e.headerInfo.microBlockSize,
										blobSize: e.headerInfo.blobSize,
										maxZError: e.headerInfo.maxZError,
										pixelType: s.getPixelType(e.headerInfo.imageType),
										eofOffset: e.eofOffset,
										mask: e.mask ? { numBytes: e.mask.numBytes } : null,
										pixels: {
											numBlocksX: e.pixels.numBlocksX,
											numBlocksY: e.pixels.numBlocksY,
											maxValue: e.headerInfo.zMax,
											minValue: e.headerInfo.zMin,
											noDataValue: e.noDataValue
										}
									};
								},
								constructConstantSurface: function (e, t) {
									var r = e.headerInfo.zMax,
										i = e.headerInfo.zMin,
										a = e.headerInfo.maxValues,
										n = e.headerInfo.numDims,
										s = e.headerInfo.height * e.headerInfo.width,
										l = 0,
										f = 0,
										o = 0,
										u = e.pixels.resultMask,
										d = e.pixels.resultPixels;
									if (u)
										if (n > 1) {
											if (t)
												for (l = 0; l < n; l++)
													for (o = l * s, r = a[l], f = 0; f < s; f++)
														u[f] && (d[o + f] = r);
											else
												for (f = 0; f < s; f++)
													if (u[f])
														for (o = f * n, l = 0; l < n; l++)
															d[o + n] = a[l];
										} else for (f = 0; f < s; f++) u[f] && (d[f] = r);
									else if (n > 1 && i !== r)
										if (t)
											for (l = 0; l < n; l++)
												for (o = l * s, r = a[l], f = 0; f < s; f++)
													d[o + f] = r;
										else
											for (f = 0; f < s; f++)
												for (o = f * n, l = 0; l < n; l++) d[o + l] = a[l];
									else for (f = 0; f < s * n; f++) d[f] = r;
								},
								getDataTypeArray: function (e) {
									var t;
									switch (e) {
										case 0:
											t = Int8Array;
											break;
										case 1:
											t = Uint8Array;
											break;
										case 2:
											t = Int16Array;
											break;
										case 3:
											t = Uint16Array;
											break;
										case 4:
											t = Int32Array;
											break;
										case 5:
											t = Uint32Array;
											break;
										case 6:
										default:
											t = Float32Array;
											break;
										case 7:
											t = Float64Array;
									}
									return t;
								},
								getPixelType: function (e) {
									var t;
									switch (e) {
										case 0:
											t = 'S8';
											break;
										case 1:
											t = 'U8';
											break;
										case 2:
											t = 'S16';
											break;
										case 3:
											t = 'U16';
											break;
										case 4:
											t = 'S32';
											break;
										case 5:
											t = 'U32';
											break;
										case 6:
										default:
											t = 'F32';
											break;
										case 7:
											t = 'F64';
									}
									return t;
								},
								isValidPixelValue: function (e, t) {
									if (null == t) return !1;
									var r;
									switch (e) {
										case 0:
											r = t >= -128 && t <= 127;
											break;
										case 1:
											r = t >= 0 && t <= 255;
											break;
										case 2:
											r = t >= -32768 && t <= 32767;
											break;
										case 3:
											r = t >= 0 && t <= 65536;
											break;
										case 4:
											r = t >= -2147483648 && t <= 2147483647;
											break;
										case 5:
											r = t >= 0 && t <= 4294967296;
											break;
										case 6:
											r =
												t >= -34027999387901484e22 &&
												t <= 34027999387901484e22;
											break;
										case 7:
											r =
												t >= -17976931348623157e292 &&
												t <= 17976931348623157e292;
											break;
										default:
											r = !1;
									}
									return r;
								},
								getDataTypeSize: function (e) {
									var t = 0;
									switch (e) {
										case 0:
										case 1:
											t = 1;
											break;
										case 2:
										case 3:
											t = 2;
											break;
										case 4:
										case 5:
										case 6:
											t = 4;
											break;
										case 7:
											t = 8;
											break;
										default:
											t = e;
									}
									return t;
								},
								getDataTypeUsed: function (e, t) {
									var r = e;
									switch (e) {
										case 2:
										case 4:
											r = e - t;
											break;
										case 3:
										case 5:
											r = e - 2 * t;
											break;
										case 6:
											r = 0 === t ? e : 1 === t ? 2 : 1;
											break;
										case 7:
											r = 0 === t ? e : e - 2 * t + 1;
											break;
										default:
											r = e;
									}
									return r;
								},
								getOnePixel: function (e, t, r, i) {
									var a = 0;
									switch (r) {
										case 0:
											a = i.getInt8(t);
											break;
										case 1:
											a = i.getUint8(t);
											break;
										case 2:
											a = i.getInt16(t, !0);
											break;
										case 3:
											a = i.getUint16(t, !0);
											break;
										case 4:
											a = i.getInt32(t, !0);
											break;
										case 5:
											a = i.getUInt32(t, !0);
											break;
										case 6:
											a = i.getFloat32(t, !0);
											break;
										case 7:
											a = i.getFloat64(t, !0);
											break;
										default:
											throw 'the decoder does not understand this pixel type';
									}
									return a;
								},
								swapDimensionOrder: function (e, t, r, i, a) {
									var n = 0,
										s = 0,
										l = 0,
										f = 0,
										o = e;
									if (r > 1)
										if (((o = new i(t * r)), a))
											for (n = 0; n < t; n++)
												for (f = n, l = 0; l < r; l++, f += t)
													o[f] = e[s++];
										else
											for (n = 0; n < t; n++)
												for (f = n, l = 0; l < r; l++, f += t)
													o[s++] = e[f];
									return o;
								}
							},
							l = function (e, t, r) {
								((this.val = e), (this.left = t), (this.right = r));
							};
						return {
							decode: function (e, t) {
								var r = (t = t || {}).noDataValue,
									i = 0,
									a = {};
								if (
									((a.ptr = t.inputOffset || 0),
									(a.pixels = {}),
									s.readHeaderInfo(e, a))
								) {
									var n = a.headerInfo,
										l = n.fileVersion,
										f = s.getDataTypeArray(n.imageType);
									if (l > 5) throw 'unsupported lerc version 2.' + l;
									(s.readMask(e, a),
										n.numValidPixel === n.width * n.height ||
											a.pixels.resultMask ||
											(a.pixels.resultMask = t.maskData));
									var o = n.width * n.height;
									((a.pixels.resultPixels = new f(o * n.numDims)),
										(a.counter = {
											onesweep: 0,
											uncompressed: 0,
											lut: 0,
											bitstuffer: 0,
											constant: 0,
											constantoffset: 0
										}));
									var u,
										d = !t.returnPixelInterleavedDims;
									if (0 !== n.numValidPixel)
										if (n.zMax === n.zMin) s.constructConstantSurface(a, d);
										else if (l >= 4 && s.checkMinMaxRanges(e, a))
											s.constructConstantSurface(a, d);
										else {
											var c = new DataView(e, a.ptr, 2),
												h = c.getUint8(0);
											if ((a.ptr++, h)) s.readDataOneSweep(e, a, f, d);
											else if (
												l > 1 &&
												n.imageType <= 1 &&
												Math.abs(n.maxZError - 0.5) < 1e-5
											) {
												var m = c.getUint8(1);
												if (
													(a.ptr++,
													(a.encodeMode = m),
													m > 2 || (l < 4 && m > 1))
												)
													throw 'Invalid Huffman flag ' + m;
												m
													? s.readHuffman(e, a, f, d)
													: s.readTiles(e, a, f, d);
											} else s.readTiles(e, a, f, d);
										}
									((a.eofOffset = a.ptr),
										t.inputOffset
											? ((u = a.headerInfo.blobSize + t.inputOffset - a.ptr),
												Math.abs(u) >= 1 &&
													(a.eofOffset =
														t.inputOffset + a.headerInfo.blobSize))
											: ((u = a.headerInfo.blobSize - a.ptr),
												Math.abs(u) >= 1 &&
													(a.eofOffset = a.headerInfo.blobSize)));
									var p = {
										width: n.width,
										height: n.height,
										pixelData: a.pixels.resultPixels,
										minValue: n.zMin,
										maxValue: n.zMax,
										validPixelCount: n.numValidPixel,
										dimCount: n.numDims,
										dimStats: {
											minValues: n.minValues,
											maxValues: n.maxValues
										},
										maskData: a.pixels.resultMask
									};
									if (
										a.pixels.resultMask &&
										s.isValidPixelValue(n.imageType, r)
									) {
										var g = a.pixels.resultMask;
										for (i = 0; i < o; i++) g[i] || (p.pixelData[i] = r);
										p.noDataValue = r;
									}
									return (
										(a.noDataValue = r),
										t.returnFileInfo && (p.fileInfo = s.formatFileInfo(a)),
										p
									);
								}
							},
							getBandCount: function (e) {
								for (
									var t = 0, r = 0, i = { ptr: 0, pixels: {} };
									r < e.byteLength - 58;

								)
									(s.readHeaderInfo(e, i),
										(r += i.headerInfo.blobSize),
										t++,
										(i.ptr = r));
								return t;
							}
						};
					})(),
					n = (function () {
						var e = new ArrayBuffer(4),
							t = new Uint8Array(e);
						return ((new Uint32Array(e)[0] = 1), 1 === t[0]);
					})(),
					s = {
						decode: function (e, t) {
							if (!n) throw 'Big endian system is not supported.';
							var r,
								s,
								l = (t = t || {}).inputOffset || 0,
								f = new Uint8Array(e, l, 10),
								o = String.fromCharCode.apply(null, f);
							if ('CntZImage' === o.trim()) ((r = i), (s = 1));
							else {
								if ('Lerc2' !== o.substring(0, 5))
									throw 'Unexpected file identifier string: ' + o;
								((r = a), (s = 2));
							}
							for (
								var u,
									d,
									c,
									h,
									m,
									p,
									g = 0,
									w = e.byteLength - 10,
									x = [],
									k = {
										width: 0,
										height: 0,
										pixels: [],
										pixelType: t.pixelType,
										mask: null,
										statistics: []
									},
									y = 0;
								l < w;

							) {
								var b = r.decode(e, {
									inputOffset: l,
									encodedMaskData: u,
									maskData: c,
									returnMask: 0 === g,
									returnEncodedMask: 0 === g,
									returnFileInfo: !0,
									returnPixelInterleavedDims: t.returnPixelInterleavedDims,
									pixelType: t.pixelType || null,
									noDataValue: t.noDataValue || null
								});
								((l = b.fileInfo.eofOffset),
									(c = b.maskData),
									0 === g &&
										((u = b.encodedMaskData),
										(k.width = b.width),
										(k.height = b.height),
										(k.dimCount = b.dimCount || 1),
										(k.pixelType = b.pixelType || b.fileInfo.pixelType),
										(k.mask = c)),
									s > 1 &&
										(c && x.push(c),
										b.fileInfo.mask && b.fileInfo.mask.numBytes > 0 && y++),
									g++,
									k.pixels.push(b.pixelData),
									k.statistics.push({
										minValue: b.minValue,
										maxValue: b.maxValue,
										noDataValue: b.noDataValue,
										dimStats: b.dimStats
									}));
							}
							if (s > 1 && y > 1) {
								for (
									p = k.width * k.height,
										k.bandMasks = x,
										(c = new Uint8Array(p)).set(x[0]),
										h = 1;
									h < x.length;
									h++
								)
									for (d = x[h], m = 0; m < p; m++) c[m] = c[m] & d[m];
								k.maskData = c;
							}
							return k;
						}
					};
				void 0 ===
					(r = function () {
						return s;
					}.apply(t, [])) || (e.exports = r);
			})();
		},
		1762: function (e, t, r) {
			'use strict';
			(r.r(t),
				r.d(t, {
					default: function () {
						return d;
					}
				}));
			var i = r(9249),
				a = r(7371),
				n = r(5754),
				s = r(6906),
				l = r(701),
				f = r(8884),
				o = r(3025),
				u = r(6825),
				d = (function (e) {
					(0, n.Z)(r, e);
					var t = (0, s.Z)(r);
					function r(e) {
						var a;
						return (
							(0, i.Z)(this, r),
							((a = t.call(this)).planarConfiguration =
								'undefined' !== typeof e.PlanarConfiguration
									? e.PlanarConfiguration
									: 1),
							(a.samplesPerPixel =
								'undefined' !== typeof e.SamplesPerPixel ? e.SamplesPerPixel : 1),
							(a.addCompression = e.LercParameters[u.L5.AddCompression]),
							a
						);
					}
					return (
						(0, a.Z)(r, [
							{
								key: 'decodeBlock',
								value: function (e) {
									switch (this.addCompression) {
										case u.Qb.None:
											break;
										case u.Qb.Deflate:
											e = (0, l.rr)(new Uint8Array(e)).buffer;
											break;
										default:
											throw new Error(
												'Unsupported LERC additional compression method identifier: '.concat(
													this.addCompression
												)
											);
									}
									return f.decode(e, {
										returnPixelInterleavedDims: 1 === this.planarConfiguration
									}).pixels[0].buffer;
								}
							}
						]),
						r
					);
				})(o.Z);
		}
	}
]);
