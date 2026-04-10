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
	[559],
	{
		6559: function (e, n, t) {
			(t.r(n),
				t.d(n, {
					default: function () {
						return d;
					}
				}));
			var u = t(9249),
				o = t(7371),
				f = t(5754),
				i = t(6906),
				r = t(701),
				d = (function (e) {
					(0, f.Z)(t, e);
					var n = (0, i.Z)(t);
					function t() {
						return ((0, u.Z)(this, t), n.apply(this, arguments));
					}
					return (
						(0, o.Z)(t, [
							{
								key: 'decodeBlock',
								value: function (e) {
									return (0, r.rr)(new Uint8Array(e)).buffer;
								}
							}
						]),
						t
					);
				})(t(3025).Z);
		}
	}
]);
