'use strict';
/*!
 * @fileoverview 来至locutus项目的整合与修正: https://locutus.io/php/
 * @version 1.0.0
 * @author hkargc <hkargc at gmail dot com>
 * @copyright (c) 2026 [hkargc <hkargc at gmail dot com>]. All rights reserved.
 * @license Licensed under the MIT License.
 */
const $GLOBALS = typeof window === 'object' && window !== null ? window : self;
const $_GET = (function() {
	if (typeof document === 'undefined' || !document.location) {
		return {};
	}
	let params = new URL(document.location).searchParams;
	let get = {};
	for (let pair of params.entries()) {
		get[pair[0]] = pair[1];
	}
	return get;
})();
const $_COOKIE = (function() {
	if (typeof document === 'undefined' || !document.cookie) {
		return {};
	}
	return document.cookie.split(';').reduce(((acc, cookie) => {
		const index = cookie.indexOf('=');
		if (index === -1) {
			return acc;
		}
		const name = cookie.slice(0, index).trim();
		const val = cookie.slice(index + 1).trim();
		try {
			const decodedName = decodeURIComponent(name);
			const decodedVal = decodeURIComponent(val);
			acc[decodedName] = decodedVal;
		} catch (e) {
			acc[name] = val;
		}
		return acc;
	}), {});
})();
(function(global) {
	const findPointerIndex = (pointers, target) => {
		for (let index = 0; index < pointers.length; index += 1) {
			if (pointers[index] === target) {
				return index;
			}
		}
		return -1;
	};

	function getPointerState(target, initialize = true) {
		const runtime = ensurePhpRuntimeState();
		const pointers = runtime.pointers;
		const pointerTarget = target;
		let index = findPointerIndex(pointers, pointerTarget);
		if (index === -1) {
			if (!initialize) {
				return null;
			}
			pointers.push(pointerTarget, 0);
			index = pointers.length - 2;
		}
		const cursorValue = pointers[index + 1];
		const cursor = typeof cursorValue === 'number' ? cursorValue : 0;
		return {
			'cursor': cursor,
			'setCursor': nextCursor => {
				pointers[index + 1] = nextCursor;
			}
		};
	}

	function getArrayLikeLength(target) {
		if (Array.isArray(target)) {
			return target.length;
		}
		let count = 0;
		for (const _key in target) {
			count += 1;
		}
		return count;
	}

	function getEntryAtCursor(target, cursor) {
		if (cursor < 0) {
			return null;
		}
		if (Array.isArray(target)) {
			if (cursor >= target.length) {
				return null;
			}
			const value = target[cursor];
			if (typeof value === 'undefined') {
				return null;
			}
			return [cursor, value];
		}
		let index = 0;
		for (const [key, value] of entriesOfPhpAssoc(target)) {
			if (index === cursor) {
				return [key, value];
			}
			index += 1;
		}
		return null;
	}

	function createBcLibrary() {
		const digitAt = (value, index) => value[index] ?? 0;
		const Libbcmath = {
			'PLUS': '+',
			'MINUS': '-',
			'BASE': 10,
			'scale': 0,
			'bc_num': function() {
				const value = {
					'n_sign': Libbcmath.PLUS,
					'n_len': 0,
					'n_scale': 0,
					'n_value': [],
					'toString': function() {
						let r;
						let tmp;
						tmp = value.n_value.join('');
						r = (value.n_sign === Libbcmath.PLUS ? '' : value.n_sign) + tmp.substr(0, value.n_len);
						if (value.n_scale > 0) {
							r += '.' + tmp.substr(value.n_len, value.n_scale);
						}
						return r;
					}
				};
				return value;
			},
			'bc_add': function(n1, n2, scaleMin) {
				let sum = Libbcmath.bc_init_num();
				let cmpRes;
				let resScale;
				if (n1.n_sign === n2.n_sign) {
					sum = Libbcmath._bc_do_add(n1, n2, scaleMin);
					sum.n_sign = n1.n_sign;
				} else {
					cmpRes = Libbcmath._bc_do_compare(n1, n2, false, false);
					switch (cmpRes) {
						case -1:
							sum = Libbcmath._bc_do_sub(n2, n1, scaleMin);
							sum.n_sign = n2.n_sign;
							break;
						case 0:
							resScale = Libbcmath.MAX(scaleMin, Libbcmath.MAX(n1.n_scale, n2.n_scale));
							sum = Libbcmath.bc_new_num(1, resScale);
							Libbcmath.memset(sum.n_value, 0, 0, resScale + 1);
							break;
						case 1:
							sum = Libbcmath._bc_do_sub(n1, n2, scaleMin);
							sum.n_sign = n1.n_sign;
					}
				}
				return sum;
			},
			'bc_compare': function(n1, n2) {
				return Libbcmath._bc_do_compare(n1, n2, true, false);
			},
			'_one_mult': function(num, nPtr, size, digit, result, rPtr) {
				let carry;
				let value;
				let nptr;
				let rptr;
				if (digit === 0) {
					Libbcmath.memset(result, 0, 0, size);
				} else {
					if (digit === 1) {
						Libbcmath.memcpy(result, rPtr, num, nPtr, size);
					} else {
						nptr = nPtr + size - 1;
						rptr = rPtr + size - 1;
						carry = 0;
						while (size-- > 0) {
							value = digitAt(num, nptr--) * digit + carry;
							result[rptr--] = value % Libbcmath.BASE;
							carry = Math.floor(value / Libbcmath.BASE);
						}
						if (carry !== 0) {
							result[rptr] = carry;
						}
					}
				}
			},
			'bc_divide': function(n1, n2, scale) {
				let qval;
				let num1;
				let num2;
				let ptr1;
				let ptr2;
				let n2ptr;
				let qptr;
				let scale1;
				let val;
				let len1;
				let len2;
				let scale2;
				let qdigits;
				let extra;
				let count;
				let qdig;
				let qguess;
				let borrow;
				let carry;
				let mval;
				let zero;
				let norm;
				if (Libbcmath.bc_is_zero(n2)) {
					return -1;
				}
				if (Libbcmath.bc_is_zero(n1)) {
					return Libbcmath.bc_new_num(1, scale);
				}
				if (n2.n_scale === 0) {
					if (n2.n_len === 1 && n2.n_value[0] === 1) {
						qval = Libbcmath.bc_new_num(n1.n_len, scale);
						qval.n_sign = n1.n_sign === n2.n_sign ? Libbcmath.PLUS : Libbcmath.MINUS;
						Libbcmath.memset(qval.n_value, n1.n_len, 0, scale);
						Libbcmath.memcpy(qval.n_value, 0, n1.n_value, 0, n1.n_len + Libbcmath.MIN(n1.n_scale, scale));
					}
				}
				scale2 = n2.n_scale;
				n2ptr = n2.n_len + scale2 - 1;
				while (scale2 > 0 && n2.n_value[n2ptr--] === 0) {
					scale2--;
				}
				len1 = n1.n_len + scale2;
				scale1 = n1.n_scale - scale2;
				if (scale1 < scale) {
					extra = scale - scale1;
				} else {
					extra = 0;
				}
				num1 = Libbcmath.safe_emalloc(1, n1.n_len + n1.n_scale, extra + 2);
				if (num1 === null) {
					Libbcmath.bc_out_of_memory();
				}
				Libbcmath.memset(num1, 0, 0, n1.n_len + n1.n_scale + extra + 2);
				Libbcmath.memcpy(num1, 1, n1.n_value, 0, n1.n_len + n1.n_scale);
				len2 = n2.n_len + scale2;
				num2 = Libbcmath.safe_emalloc(1, len2, 1);
				if (num2 === null) {
					Libbcmath.bc_out_of_memory();
				}
				Libbcmath.memcpy(num2, 0, n2.n_value, 0, len2);
				num2[len2] = 0;
				n2ptr = 0;
				while (num2[n2ptr] === 0) {
					n2ptr++;
					len2--;
				}
				if (len2 > len1 + scale) {
					qdigits = scale + 1;
					zero = true;
				} else {
					zero = false;
					if (len2 > len1) {
						qdigits = scale + 1;
					} else {
						qdigits = len1 - len2 + scale + 1;
					}
				}
				qval = Libbcmath.bc_new_num(qdigits - scale, scale);
				Libbcmath.memset(qval.n_value, 0, 0, qdigits);
				mval = Libbcmath.safe_emalloc(1, len2, 1);
				if (mval === null) {
					Libbcmath.bc_out_of_memory();
				}
				if (!zero) {
					norm = Math.floor(10 / (digitAt(n2.n_value, n2ptr) + 1));
					if (norm !== 1) {
						Libbcmath._one_mult(num1, 0, len1 + scale1 + extra + 1, norm, num1, 0);
						Libbcmath._one_mult(n2.n_value, n2ptr, len2, norm, n2.n_value, n2ptr);
					}
					qdig = 0;
					if (len2 > len1) {
						qptr = len2 - len1;
					} else {
						qptr = 0;
					}
					while (qdig <= len1 + scale - len2) {
						if (n2.n_value[n2ptr] === num1[qdig]) {
							qguess = 9;
						} else {
							qguess = Math.floor((digitAt(num1, qdig) * 10 + digitAt(num1, qdig + 1)) / digitAt(n2.n_value, n2ptr));
						}
						if (digitAt(n2.n_value, n2ptr + 1) * qguess > (digitAt(num1, qdig) * 10 + digitAt(num1, qdig + 1) - digitAt(n2.n_value, n2ptr) * qguess) * 10 + digitAt(num1, qdig + 2)) {
							qguess--;
							if (digitAt(n2.n_value, n2ptr + 1) * qguess > (digitAt(num1, qdig) * 10 + digitAt(num1, qdig + 1) - digitAt(n2.n_value, n2ptr) * qguess) * 10 + digitAt(num1, qdig + 2)) {
								qguess--;
							}
						}
						borrow = 0;
						if (qguess !== 0) {
							mval[0] = 0;
							Libbcmath._one_mult(n2.n_value, n2ptr, len2, qguess, mval, 1);
							ptr1 = qdig + len2;
							ptr2 = len2;
							for (count = 0; count < len2 + 1; count++) {
								if (ptr2 < 0) {
									val = digitAt(num1, ptr1) - 0 - borrow;
								} else {
									val = digitAt(num1, ptr1) - digitAt(mval, ptr2--) - borrow;
								}
								if (val < 0) {
									val += 10;
									borrow = 1;
								} else {
									borrow = 0;
								}
								num1[ptr1--] = val;
							}
						}
						if (borrow === 1) {
							qguess--;
							ptr1 = qdig + len2;
							ptr2 = len2 - 1;
							carry = 0;
							for (count = 0; count < len2; count++) {
								if (ptr2 < 0) {
									val = digitAt(num1, ptr1) + 0 + carry;
								} else {
									val = digitAt(num1, ptr1) + digitAt(n2.n_value, ptr2--) + carry;
								}
								if (val > 9) {
									val -= 10;
									carry = 1;
								} else {
									carry = 0;
								}
								num1[ptr1--] = val;
							}
							if (carry === 1) {
								num1[ptr1] = (digitAt(num1, ptr1) + 1) % 10;
							}
						}
						qval.n_value[qptr++] = qguess;
						qdig++;
					}
				}
				qval.n_sign = n1.n_sign === n2.n_sign ? Libbcmath.PLUS : Libbcmath.MINUS;
				if (Libbcmath.bc_is_zero(qval)) {
					qval.n_sign = Libbcmath.PLUS;
				}
				Libbcmath._bc_rm_leading_zeros(qval);
				return qval;
			},
			'MUL_BASE_DIGITS': 80,
			'MUL_SMALL_DIGITS': 80 / 4,
			'bc_multiply': function(n1, n2, scale) {
				let pval;
				let len1;
				let len2;
				let fullScale;
				let prodScale;
				len1 = n1.n_len + n1.n_scale;
				len2 = n2.n_len + n2.n_scale;
				fullScale = n1.n_scale + n2.n_scale;
				prodScale = Libbcmath.MIN(fullScale, Libbcmath.MAX(scale, Libbcmath.MAX(n1.n_scale, n2.n_scale)));
				pval = Libbcmath._bc_rec_mul(n1, len1, n2, len2, fullScale);
				pval.n_sign = n1.n_sign === n2.n_sign ? Libbcmath.PLUS : Libbcmath.MINUS;
				pval.n_len = len2 + len1 + 1 - fullScale;
				pval.n_scale = prodScale;
				Libbcmath._bc_rm_leading_zeros(pval);
				if (Libbcmath.bc_is_zero(pval)) {
					pval.n_sign = Libbcmath.PLUS;
				}
				return pval;
			},
			'new_sub_num': function(length, scale, value, ptr = 0) {
				const temp = Libbcmath.bc_num();
				temp.n_sign = Libbcmath.PLUS;
				temp.n_len = length;
				temp.n_scale = scale;
				temp.n_value = Libbcmath.safe_emalloc(1, length + scale, 0);
				Libbcmath.memcpy(temp.n_value, 0, value, ptr, length + scale);
				return temp;
			},
			'_bc_simp_mul': function(n1, n1len, n2, n2len, fullScale) {
				let prod;
				let n1ptr;
				let n2ptr;
				let pvptr;
				let n1end;
				let n2end;
				let indx;
				let sum;
				let prodlen;
				prodlen = n1len + n2len + 1;
				prod = Libbcmath.bc_new_num(prodlen, 0);
				n1end = n1len - 1;
				n2end = n2len - 1;
				pvptr = prodlen - 1;
				sum = 0;
				for (indx = 0; indx < prodlen - 1; indx++) {
					n1ptr = n1end - Libbcmath.MAX(0, indx - n2len + 1);
					n2ptr = n2end - Libbcmath.MIN(indx, n2len - 1);
					while (n1ptr >= 0 && n2ptr <= n2end) {
						sum += digitAt(n1.n_value, n1ptr--) * digitAt(n2.n_value, n2ptr++);
					}
					prod.n_value[pvptr--] = Math.floor(sum % Libbcmath.BASE);
					sum = Math.floor(sum / Libbcmath.BASE);
				}
				prod.n_value[pvptr] = sum;
				return prod;
			},
			'_bc_shift_addsub': function(accum, val, shift, sub) {
				let accp;
				let valp;
				let count;
				let carry;
				count = val.n_len;
				if (val.n_value[0] === 0) {
					count--;
				}
				if (accum.n_len + accum.n_scale < shift + count) {
					throw new Error('len + scale < shift + count');
				}
				accp = accum.n_len + accum.n_scale - shift - 1;
				valp = val.n_len - 1;
				carry = 0;
				if (sub) {
					while (count--) {
						accum.n_value[accp] = digitAt(accum.n_value, accp) - digitAt(val.n_value, valp--) - carry;
						if (digitAt(accum.n_value, accp) < 0) {
							carry = 1;
							accum.n_value[accp] = digitAt(accum.n_value, accp) + Libbcmath.BASE;
							accp--;
						} else {
							carry = 0;
							accp--;
						}
					}
					while (carry) {
						accum.n_value[accp] = digitAt(accum.n_value, accp) - carry;
						if (digitAt(accum.n_value, accp) < 0) {
							accum.n_value[accp] = digitAt(accum.n_value, accp) + Libbcmath.BASE;
							accp--;
						} else {
							carry = 0;
						}
					}
				} else {
					while (count--) {
						accum.n_value[accp] = digitAt(accum.n_value, accp) + digitAt(val.n_value, valp--) + carry;
						if (digitAt(accum.n_value, accp) > Libbcmath.BASE - 1) {
							carry = 1;
							accum.n_value[accp] = digitAt(accum.n_value, accp) - Libbcmath.BASE;
							accp--;
						} else {
							carry = 0;
							accp--;
						}
					}
					while (carry) {
						accum.n_value[accp] = digitAt(accum.n_value, accp) + carry;
						if (digitAt(accum.n_value, accp) > Libbcmath.BASE - 1) {
							accum.n_value[accp] = digitAt(accum.n_value, accp) - Libbcmath.BASE;
							accp--;
						} else {
							carry = 0;
						}
					}
				}
				return true;
			},
			'_bc_rec_mul': function(u, ulen, v, vlen, fullScale) {
				let prod;
				let u0;
				let u1;
				let v0;
				let v1;
				let m1 = Libbcmath.bc_init_num();
				let m2 = Libbcmath.bc_init_num();
				let m3 = Libbcmath.bc_init_num();
				let d1 = Libbcmath.bc_init_num();
				let d2 = Libbcmath.bc_init_num();
				let n;
				let prodlen;
				let m1zero;
				let d1len;
				let d2len;
				if (ulen + vlen < Libbcmath.MUL_BASE_DIGITS || ulen < Libbcmath.MUL_SMALL_DIGITS || vlen < Libbcmath.MUL_SMALL_DIGITS) {
					return Libbcmath._bc_simp_mul(u, ulen, v, vlen, fullScale);
				}
				n = Math.floor((Libbcmath.MAX(ulen, vlen) + 1) / 2);
				if (ulen < n) {
					u1 = Libbcmath.bc_init_num();
					u0 = Libbcmath.new_sub_num(ulen, 0, u.n_value);
				} else {
					u1 = Libbcmath.new_sub_num(ulen - n, 0, u.n_value);
					u0 = Libbcmath.new_sub_num(n, 0, u.n_value, ulen - n);
				}
				if (vlen < n) {
					v1 = Libbcmath.bc_init_num();
					v0 = Libbcmath.new_sub_num(vlen, 0, v.n_value);
				} else {
					v1 = Libbcmath.new_sub_num(vlen - n, 0, v.n_value);
					v0 = Libbcmath.new_sub_num(n, 0, v.n_value, vlen - n);
				}
				Libbcmath._bc_rm_leading_zeros(u1);
				Libbcmath._bc_rm_leading_zeros(u0);
				Libbcmath._bc_rm_leading_zeros(v1);
				Libbcmath._bc_rm_leading_zeros(v0);
				m1zero = Libbcmath.bc_is_zero(u1) || Libbcmath.bc_is_zero(v1);
				d1 = Libbcmath.bc_init_num();
				d2 = Libbcmath.bc_init_num();
				d1 = Libbcmath.bc_sub(u1, u0, 0);
				d1len = d1.n_len;
				d2 = Libbcmath.bc_sub(v0, v1, 0);
				d2len = d2.n_len;
				if (m1zero) {
					m1 = Libbcmath.bc_init_num();
				} else {
					m1 = Libbcmath._bc_rec_mul(u1, u1.n_len, v1, v1.n_len, 0);
				}
				if (Libbcmath.bc_is_zero(d1) || Libbcmath.bc_is_zero(d2)) {
					m2 = Libbcmath.bc_init_num();
				} else {
					m2 = Libbcmath._bc_rec_mul(d1, d1len, d2, d2len, 0);
				}
				if (Libbcmath.bc_is_zero(u0) || Libbcmath.bc_is_zero(v0)) {
					m3 = Libbcmath.bc_init_num();
				} else {
					m3 = Libbcmath._bc_rec_mul(u0, u0.n_len, v0, v0.n_len, 0);
				}
				prodlen = ulen + vlen + 1;
				prod = Libbcmath.bc_new_num(prodlen, 0);
				if (!m1zero) {
					Libbcmath._bc_shift_addsub(prod, m1, 2 * n, 0);
					Libbcmath._bc_shift_addsub(prod, m1, n, 0);
				}
				Libbcmath._bc_shift_addsub(prod, m3, n, 0);
				Libbcmath._bc_shift_addsub(prod, m3, 0, 0);
				Libbcmath._bc_shift_addsub(prod, m2, n, d1.n_sign !== d2.n_sign);
				return prod;
			},
			'_bc_do_compare': function(n1, n2, useSign, ignoreLast) {
				let n1ptr;
				let n2ptr;
				let count;
				if (useSign && n1.n_sign !== n2.n_sign) {
					if (n1.n_sign === Libbcmath.PLUS) {
						return 1;
					} else {
						return -1;
					}
				}
				if (n1.n_len !== n2.n_len) {
					if (n1.n_len > n2.n_len) {
						if (!useSign || n1.n_sign === Libbcmath.PLUS) {
							return 1;
						} else {
							return -1;
						}
					} else {
						if (!useSign || n1.n_sign === Libbcmath.PLUS) {
							return -1;
						} else {
							return 1;
						}
					}
				}
				count = n1.n_len + Math.min(n1.n_scale, n2.n_scale);
				n1ptr = 0;
				n2ptr = 0;
				while (count > 0 && n1.n_value[n1ptr] === n2.n_value[n2ptr]) {
					n1ptr++;
					n2ptr++;
					count--;
				}
				if (ignoreLast && count === 1 && n1.n_scale === n2.n_scale) {
					return 0;
				}
				if (count !== 0) {
					if (digitAt(n1.n_value, n1ptr) > digitAt(n2.n_value, n2ptr)) {
						if (!useSign || n1.n_sign === Libbcmath.PLUS) {
							return 1;
						} else {
							return -1;
						}
					} else {
						if (!useSign || n1.n_sign === Libbcmath.PLUS) {
							return -1;
						} else {
							return 1;
						}
					}
				}
				if (n1.n_scale !== n2.n_scale) {
					if (n1.n_scale > n2.n_scale) {
						for (count = n1.n_scale - n2.n_scale; count > 0; count--) {
							if (digitAt(n1.n_value, n1ptr++) !== 0) {
								if (!useSign || n1.n_sign === Libbcmath.PLUS) {
									return 1;
								} else {
									return -1;
								}
							}
						}
					} else {
						for (count = n2.n_scale - n1.n_scale; count > 0; count--) {
							if (digitAt(n2.n_value, n2ptr++) !== 0) {
								if (!useSign || n1.n_sign === Libbcmath.PLUS) {
									return -1;
								} else {
									return 1;
								}
							}
						}
					}
				}
				return 0;
			},
			'bc_sub': function(n1, n2, scaleMin) {
				let diff = Libbcmath.bc_init_num();
				let cmpRes;
				let resScale;
				if (n1.n_sign !== n2.n_sign) {
					diff = Libbcmath._bc_do_add(n1, n2, scaleMin);
					diff.n_sign = n1.n_sign;
				} else {
					cmpRes = Libbcmath._bc_do_compare(n1, n2, false, false);
					switch (cmpRes) {
						case -1:
							diff = Libbcmath._bc_do_sub(n2, n1, scaleMin);
							diff.n_sign = n2.n_sign === Libbcmath.PLUS ? Libbcmath.MINUS : Libbcmath.PLUS;
							break;
						case 0:
							resScale = Libbcmath.MAX(scaleMin, Libbcmath.MAX(n1.n_scale, n2.n_scale));
							diff = Libbcmath.bc_new_num(1, resScale);
							Libbcmath.memset(diff.n_value, 0, 0, resScale + 1);
							break;
						case 1:
							diff = Libbcmath._bc_do_sub(n1, n2, scaleMin);
							diff.n_sign = n1.n_sign;
							break;
					}
				}
				return diff;
			},
			'_bc_do_add': function(n1, n2, scaleMin) {
				let sum;
				let sumScale;
				let sumDigits;
				let n1ptr;
				let n2ptr;
				let sumptr;
				let carry;
				let n1bytes;
				let n2bytes;
				let tmp;
				sumScale = Libbcmath.MAX(n1.n_scale, n2.n_scale);
				sumDigits = Libbcmath.MAX(n1.n_len, n2.n_len) + 1;
				sum = Libbcmath.bc_new_num(sumDigits, Libbcmath.MAX(sumScale, scaleMin));
				n1bytes = n1.n_scale;
				n2bytes = n2.n_scale;
				n1ptr = n1.n_len + n1bytes - 1;
				n2ptr = n2.n_len + n2bytes - 1;
				sumptr = sumScale + sumDigits - 1;
				if (n1bytes !== n2bytes) {
					if (n1bytes > n2bytes) {
						while (n1bytes > n2bytes) {
							sum.n_value[sumptr--] = digitAt(n1.n_value, n1ptr--);
							n1bytes--;
						}
					} else {
						while (n2bytes > n1bytes) {
							sum.n_value[sumptr--] = digitAt(n2.n_value, n2ptr--);
							n2bytes--;
						}
					}
				}
				n1bytes += n1.n_len;
				n2bytes += n2.n_len;
				carry = 0;
				while (n1bytes > 0 && n2bytes > 0) {
					tmp = digitAt(n1.n_value, n1ptr--) + digitAt(n2.n_value, n2ptr--) + carry;
					if (tmp >= Libbcmath.BASE) {
						carry = 1;
						tmp -= Libbcmath.BASE;
					} else {
						carry = 0;
					}
					sum.n_value[sumptr] = tmp;
					sumptr--;
					n1bytes--;
					n2bytes--;
				}
				if (n1bytes === 0) {
					while (n2bytes-- > 0) {
						tmp = digitAt(n2.n_value, n2ptr--) + carry;
						if (tmp >= Libbcmath.BASE) {
							carry = 1;
							tmp -= Libbcmath.BASE;
						} else {
							carry = 0;
						}
						sum.n_value[sumptr--] = tmp;
					}
				} else {
					while (n1bytes-- > 0) {
						tmp = digitAt(n1.n_value, n1ptr--) + carry;
						if (tmp >= Libbcmath.BASE) {
							carry = 1;
							tmp -= Libbcmath.BASE;
						} else {
							carry = 0;
						}
						sum.n_value[sumptr--] = tmp;
					}
				}
				if (carry === 1) {
					sum.n_value[sumptr] = digitAt(sum.n_value, sumptr) + 1;
				}
				Libbcmath._bc_rm_leading_zeros(sum);
				return sum;
			},
			'_bc_do_sub': function(n1, n2, scaleMin) {
				let diff;
				let diffScale;
				let diffLen;
				let minScale;
				let minLen;
				let n1ptr;
				let n2ptr;
				let diffptr;
				let borrow;
				let count;
				let val;
				diffLen = Libbcmath.MAX(n1.n_len, n2.n_len);
				diffScale = Libbcmath.MAX(n1.n_scale, n2.n_scale);
				minLen = Libbcmath.MIN(n1.n_len, n2.n_len);
				minScale = Libbcmath.MIN(n1.n_scale, n2.n_scale);
				diff = Libbcmath.bc_new_num(diffLen, Libbcmath.MAX(diffScale, scaleMin));
				n1ptr = n1.n_len + n1.n_scale - 1;
				n2ptr = n2.n_len + n2.n_scale - 1;
				diffptr = diffLen + diffScale - 1;
				borrow = 0;
				if (n1.n_scale !== minScale) {
					for (count = n1.n_scale - minScale; count > 0; count--) {
						diff.n_value[diffptr--] = digitAt(n1.n_value, n1ptr--);
					}
				} else {
					for (count = n2.n_scale - minScale; count > 0; count--) {
						val = 0 - digitAt(n2.n_value, n2ptr--) - borrow;
						if (val < 0) {
							val += Libbcmath.BASE;
							borrow = 1;
						} else {
							borrow = 0;
						}
						diff.n_value[diffptr--] = val;
					}
				}
				for (count = 0; count < minLen + minScale; count++) {
					val = digitAt(n1.n_value, n1ptr--) - digitAt(n2.n_value, n2ptr--) - borrow;
					if (val < 0) {
						val += Libbcmath.BASE;
						borrow = 1;
					} else {
						borrow = 0;
					}
					diff.n_value[diffptr--] = val;
				}
				if (diffLen !== minLen) {
					for (count = diffLen - minLen; count > 0; count--) {
						val = digitAt(n1.n_value, n1ptr--) - borrow;
						if (val < 0) {
							val += Libbcmath.BASE;
							borrow = 1;
						} else {
							borrow = 0;
						}
						diff.n_value[diffptr--] = val;
					}
				}
				Libbcmath._bc_rm_leading_zeros(diff);
				return diff;
			},
			'bc_new_num': function(length, scale) {
				let temp;
				temp = Libbcmath.bc_num();
				temp.n_sign = Libbcmath.PLUS;
				temp.n_len = length;
				temp.n_scale = scale;
				temp.n_value = Libbcmath.safe_emalloc(1, length + scale, 0);
				Libbcmath.memset(temp.n_value, 0, 0, length + scale);
				return temp;
			},
			'safe_emalloc': function(size, len, extra) {
				return new Array(size * len + extra);
			},
			'bc_init_num': function() {
				return Libbcmath.bc_new_num(1, 0);
			},
			'_bc_rm_leading_zeros': function(num) {
				while (num.n_value[0] === 0 && num.n_len > 1) {
					num.n_value.shift();
					num.n_len--;
				}
			},
			'php_str2num': function(str) {
				let p;
				p = str.indexOf('.');
				if (p === -1) {
					return Libbcmath.bc_str2num(str, 0);
				} else {
					return Libbcmath.bc_str2num(str, str.length - p);
				}
			},
			'CH_VAL': function(c) {
				return Number(c) - 0;
			},
			'BCD_CHAR': function(d) {
				return String(d) + '0';
			},
			'isdigit': function(c) {
				return isNaN(parseInt(c, 10));
			},
			'bc_str2num': function(strIn, scale) {
				let str;
				let num;
				let ptr;
				let digits;
				let strscale;
				let zeroInt;
				let nptr;
				str = strIn.split('');
				ptr = 0;
				digits = 0;
				strscale = 0;
				zeroInt = false;
				if (str[ptr] === '+' || str[ptr] === '-') {
					ptr++;
				}
				while (str[ptr] === '0') {
					ptr++;
				}
				while (str[ptr] !== undefined && /\d/.test(str[ptr] ?? '')) {
					ptr++;
					digits++;
				}
				if (str[ptr] === '.') {
					ptr++;
				}
				while (str[ptr] !== undefined && /\d/.test(str[ptr] ?? '')) {
					ptr++;
					strscale++;
				}
				if (str[ptr] || digits + strscale === 0) {
					return Libbcmath.bc_init_num();
				}
				strscale = Libbcmath.MIN(strscale, scale);
				if (digits === 0) {
					zeroInt = true;
					digits = 1;
				}
				num = Libbcmath.bc_new_num(digits, strscale);
				ptr = 0;
				if (str[ptr] === '-') {
					num.n_sign = Libbcmath.MINUS;
					ptr++;
				} else {
					num.n_sign = Libbcmath.PLUS;
					if (str[ptr] === '+') {
						ptr++;
					}
				}
				while (str[ptr] === '0') {
					ptr++;
				}
				nptr = 0;
				if (zeroInt) {
					num.n_value[nptr++] = 0;
					digits = 0;
				}
				for (; digits > 0; digits--) {
					num.n_value[nptr++] = Libbcmath.CH_VAL(str[ptr++] ?? '0');
				}
				if (strscale > 0) {
					ptr++;
					for (; strscale > 0; strscale--) {
						num.n_value[nptr++] = Libbcmath.CH_VAL(str[ptr++] ?? '0');
					}
				}
				return num;
			},
			'cint': function(v) {
				if (typeof v === 'undefined') {
					v = 0;
				}
				let x = Number.parseInt(String(v), 10);
				if (isNaN(x)) {
					x = 0;
				}
				return x;
			},
			'MIN': function(a, b) {
				return a > b ? b : a;
			},
			'MAX': function(a, b) {
				return a > b ? a : b;
			},
			'ODD': function(a) {
				return a & 1;
			},
			'memset': function(r, ptr, chr, len) {
				let i;
				for (i = 0; i < len; i++) {
					r[ptr + i] = chr;
				}
			},
			'memcpy': function(dest, ptr, src, srcptr, len) {
				let i;
				for (i = 0; i < len; i++) {
					dest[ptr + i] = src[srcptr + i] ?? 0;
				}
				return true;
			},
			'bc_is_zero': function(num) {
				let count;
				let nptr;
				count = num.n_len + num.n_scale;
				nptr = 0;
				while (count > 0 && num.n_value[nptr++] === 0) {
					count--;
				}
				if (count !== 0) {
					return false;
				} else {
					return true;
				}
			},
			'bc_out_of_memory': function() {
				throw new Error('(BC) Out of memory');
			}
		};
		return Libbcmath;
	}

	function isBcLibrary(value) {
		return typeof value === 'object' && value !== null && 'bc_add' in value && 'scale' in value;
	}

	function _bc() {
		const existing = getPhpRuntimeEntry('bcMathLib');
		if (isBcLibrary(existing)) {
			return existing;
		}
		const library = createBcLibrary();
		setPhpRuntimeEntry('bcMathLib', library);
		return library;
	}

	function resolvePhpCallable(callback, options) {
		if (isPhpCallable(callback)) {
			return {
				'fn': callback,
				'scope': null
			};
		}
		if (typeof callback === 'string') {
			const candidate = getPhpGlobalEntry(callback);
			if (isPhpCallable(candidate)) {
				return {
					'fn': candidate,
					'scope': null
				};
			}
			throw new Error(options.invalidMessage);
		}
		if (Array.isArray(callback) && callback.length >= 2) {
			const scopeDescriptor = callback[0];
			const callableDescriptor = callback[1];
			let scope;
			if (typeof scopeDescriptor === 'string') {
				scope = getPhpGlobalEntry(scopeDescriptor);
				if (typeof scope === 'undefined' && options.missingScopeMessage) {
					throw new Error(options.missingScopeMessage(scopeDescriptor));
				}
			} else {
				scope = scopeDescriptor;
			}
			if (isPhpCallable(callableDescriptor)) {
				return {
					'fn': callableDescriptor,
					'scope': scope
				};
			}
			if (typeof callableDescriptor === 'string' && (isObjectLike(scope) || typeof scope === 'function')) {
				const candidate = getPhpObjectEntry(scope, callableDescriptor);
				if (isPhpCallable(candidate)) {
					return {
						'fn': candidate,
						'scope': scope
					};
				}
			}
		}
		throw new Error(options.invalidMessage);
	}

	function resolveNumericComparator(callback, invalidMessage) {
		const resolved = resolvePhpCallable(callback, {
			'invalidMessage': invalidMessage
		});
		return (left, right) => Number(resolved.fn.apply(resolved.scope, [left, right]));
	}
	const defaultCtypePatterns = {
		'an': /^[A-Za-z\d]+$/g,
		'al': /^[A-Za-z]+$/g,
		'ct': /^[\u0000-\u001F\u007F]+$/g,
		'dg': /^[\d]+$/g,
		'gr': /^[\u0021-\u007E]+$/g,
		'lw': /^[a-z]+$/g,
		'pr': /^[\u0020-\u007E]+$/g,
		'pu': /^[\u0021-\u002F\u003A-\u0040\u005B-\u0060\u007B-\u007E]+$/g,
		'sp': /^[\f\n\r\t\v ]+$/g,
		'up': /^[A-Z]+$/g,
		'xd': /^[A-Fa-f\d]+$/g
	};

	function getCtypePattern(key) {
		const ctypeGroup = getPhpLocaleGroup('LC_CTYPE', 'LC_CTYPE');
		if (!ctypeGroup) {
			const fallbackPattern = defaultCtypePatterns[key];
			return fallbackPattern ? new RegExp(fallbackPattern) : undefined;
		}
		const pattern = ctypeGroup[key];
		if (pattern instanceof RegExp) {
			return new RegExp(pattern);
		}
		const fallbackPattern = defaultCtypePatterns[key];
		return fallbackPattern ? new RegExp(fallbackPattern) : undefined;
	}

	function _php_cast_string(value) {
		if (typeof value === 'boolean') {
			return value ? '1' : '';
		}
		if (typeof value === 'string') {
			return value;
		}
		if (typeof value === 'number') {
			if (isNaN(value)) {
				return 'NAN';
			}
			if (!isFinite(value)) {
				return (value < 0 ? '-' : '') + 'INF';
			}
			return value + '';
		}
		if (typeof value === 'undefined') {
			return '';
		}
		if (typeof value === 'object') {
			if (Array.isArray(value)) {
				return 'Array';
			}
			if (value !== null) {
				return 'Object';
			}
			return '';
		}
		throw new Error('Unsupported value type');
	}
	const ensurePhpRuntimeObject = () => {
		let locutus = global.$locutus;
		if (typeof locutus !== 'object' || locutus === null) {
			locutus = {};
			global.$locutus = locutus;
		}
		let php = locutus.php;
		if (typeof php !== 'object' || php === null) {
			php = {};
			locutus.php = php;
		}
		return php;
	};

	function ensurePhpRuntimeState() {
		const php = ensurePhpRuntimeObject();
		const iniValue = php.ini;
		const localesValue = php.locales;
		const localeCategoriesValue = php.localeCategories;
		const pointersValue = php.pointers;
		const ini = isPhpAssocObject(iniValue) ? iniValue : {};
		const locales = isPhpAssocObject(localesValue) ? localesValue : {};
		const localeCategories = isPhpAssocObject(localeCategoriesValue) ? localeCategoriesValue : {};
		const pointers = Array.isArray(pointersValue) ? pointersValue : [];
		if (iniValue !== ini) {
			php.ini = ini;
		}
		if (localesValue !== locales) {
			php.locales = locales;
		}
		if (localeCategoriesValue !== localeCategories) {
			php.localeCategories = localeCategories;
		}
		if (pointersValue !== pointers) {
			php.pointers = pointers;
		}
		const localeDefaultValue = php.locale_default;
		const localeDefault = typeof localeDefaultValue === 'string' ? localeDefaultValue : undefined;
		return {
			'ini': ini,
			'locales': locales,
			'localeCategories': localeCategories,
			'pointers': pointers,
			'locale_default': localeDefault
		};
	}

	function getPhpRuntimeEntry(key) {
		const php = ensurePhpRuntimeObject();
		const value = php[key];
		return typeof value === 'undefined' ? undefined : value;
	}

	function setPhpRuntimeEntry(key, value) {
		const php = ensurePhpRuntimeObject();
		php[key] = value;
	}

	function getPhpRuntimeNumber(key, fallback) {
		const value = getPhpRuntimeEntry(key);
		return typeof value === 'number' ? value : fallback;
	}

	function getPhpRuntimeString(key, fallback) {
		const value = getPhpRuntimeEntry(key);
		return typeof value === 'string' ? value : fallback;
	}

	function getPhpGlobalEntry(key) {
		const value = global[key];
		return typeof value === 'undefined' ? undefined : value;
	}

	function setPhpGlobalEntry(key, value) {
		global[key] = value;
	}

	function getPhpGlobalScope() {
		return global;
	}

	function getPhpGlobalCallable(key) {
		const value = getPhpGlobalEntry(key);
		return isPhpCallable(value) ? value : undefined;
	}

	function getPhpObjectEntry(value, key) {
		if (typeof value !== 'object' && typeof value !== 'function' || value === null) {
			return undefined;
		}
		let current = value;
		while (current) {
			const descriptor = Object.getOwnPropertyDescriptor(current, key);
			if (descriptor) {
				if (typeof descriptor.get === 'function') {
					const getterValue = descriptor.get.call(value);
					return typeof getterValue === 'undefined' ? undefined : getterValue;
				}
				const directValue = descriptor.value;
				return typeof directValue === 'undefined' ? undefined : directValue;
			}
			current = Object.getPrototypeOf(current);
		}
		return undefined;
	}

	function getPhpLocaleEntry(category) {
		const runtime = ensurePhpRuntimeState();
		const localeName = runtime.localeCategories[category];
		if (typeof localeName !== 'string') {
			return undefined;
		}
		const localeEntry = runtime.locales[localeName];
		return isPhpAssocObject(localeEntry) ? localeEntry : undefined;
	}

	function getPhpLocaleGroup(category, groupKey) {
		const localeEntry = getPhpLocaleEntry(category);
		if (!localeEntry) {
			return undefined;
		}
		const group = localeEntry[groupKey];
		return isPhpAssocObject(group) ? group : undefined;
	}
	const entriesOfPhpAssoc = value => Object.entries(value);

	function normalizeArrayKey(key) {
		if (/^(0|-?[1-9]\d*)$/.test(key)) {
			const numericKey = Number(key);
			if (Number.isSafeInteger(numericKey)) {
				return numericKey;
			}
		}
		return key;
	}

	function isPhpList(value) {
		return Array.isArray(value);
	}

	function isObjectLike(value) {
		return typeof value === 'object' && value !== null;
	}

	function isPhpAssocObject(value) {
		return isObjectLike(value) && !isPhpList(value);
	}

	function isPhpScalar(value) {
		return typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean';
	}

	function isPhpKey(value) {
		return typeof value === 'string' || typeof value === 'number';
	}

	function isNumericLike(value) {
		if (typeof value === 'number') {
			return Number.isFinite(value);
		}
		if (typeof value === 'bigint') {
			return true;
		}
		if (typeof value !== 'string') {
			return false;
		}
		const trimmed = value.trim();
		if (trimmed === '') {
			return false;
		}
		return Number.isFinite(Number(trimmed));
	}

	function isPhpCallable(value) {
		return typeof value === 'function';
	}

	function isPhpCallableDescriptor(value) {
		if (typeof value === 'string') {
			return true;
		}
		if (isPhpCallable(value)) {
			return true;
		}
		if (!Array.isArray(value) || value.length < 2) {
			return false;
		}
		const callableDescriptor = value[1];
		return typeof callableDescriptor === 'string' || isPhpCallable(callableDescriptor);
	}

	function isPhpArrayObject(value) {
		return isObjectLike(value);
	}

	function toPhpArrayObject(value) {
		if (isPhpArrayObject(value)) {
			return value;
		}
		return {};
	}

	function _php_cast_float(value) {
		if (typeof value === 'number') {
			return value;
		}
		if (typeof value === 'string') {
			return parseFloat(value) || 0;
		}
		return _php_cast_int(value);
	}

	function _php_cast_int(value) {
		if (typeof value === 'number') {
			if (isNaN(value) || !isFinite(value)) {
				return 0;
			}
			return value < 0 ? Math.ceil(value) : Math.floor(value);
		}
		if (typeof value === 'string') {
			return parseInt(value, 10) || 0;
		}
		return +!!value;
	}

	function array_change_key_case(array, cs) {
		let result;
		if (Array.isArray(array)) {
			result = array;
		} else if (!array || typeof array !== 'object') {
			result = false;
		} else {
			const caseFunction = cs === undefined || cs === 0 || cs === 'CASE_LOWER' ? 'toLowerCase' : 'toUpperCase';
			const source = toPhpArrayObject(array);
			const transformed = {};
			for (const [key, value] of Object.entries(source)) {
				transformed[key[caseFunction]()] = value;
			}
			result = transformed;
		}
		return result;
	}

	function array_chunk(input, size, preserveKeys) {
		if (size < 1) {
			return null;
		}
		const keepKeys = Boolean(preserveKeys);
		if (Array.isArray(input)) {
			if (keepKeys) {
				const chunks = [];
				for (const [i, value] of input.entries()) {
					const chunkIndex = Math.floor(i / size);
					if (!chunks[chunkIndex]) {
						chunks[chunkIndex] = {};
					}
					chunks[chunkIndex][String(i)] = value;
				}
				return chunks;
			} else {
				const chunks = [];
				for (const [i, value] of input.entries()) {
					const chunkIndex = Math.floor(i / size);
					if (!chunks[chunkIndex]) {
						chunks[chunkIndex] = [];
					}
					chunks[chunkIndex].push(value);
				}
				return chunks;
			}
		} else {
			const inputEntries = Object.entries(input);
			if (keepKeys) {
				const chunks = [];
				for (const [i, [key, value]] of inputEntries.entries()) {
					const chunkIndex = Math.floor(i / size);
					if (!chunks[chunkIndex]) {
						chunks[chunkIndex] = {};
					}
					chunks[chunkIndex][key] = value;
				}
				return chunks;
			} else {
				const chunks = [];
				for (const [i, [, value]] of inputEntries.entries()) {
					const chunkIndex = Math.floor(i / size);
					if (!chunks[chunkIndex]) {
						chunks[chunkIndex] = [];
					}
					chunks[chunkIndex].push(value);
				}
				return chunks;
			}
		}
	}

	function array_column(input, columnKey, indexKey) {
		if (input === null || typeof input !== 'object') {
			return undefined;
		}
		const normalizedInput = Array.isArray(input) ? input : Object.values(toPhpArrayObject(input));
		const result = {};
		let fallbackIndex = 0;
		for (const rowValue of normalizedInput) {
			const row = toPhpArrayObject(rowValue);
			const indexCandidate = indexKey === null ? undefined : row[String(indexKey)];
			const value = columnKey === null ? rowValue : row[String(columnKey)];
			if (indexCandidate !== undefined && indexCandidate !== null) {
				result[String(indexCandidate)] = value;
			} else {
				result[String(fallbackIndex)] = value;
				fallbackIndex += 1;
			}
		}
		return result;
	}

	function array_combine(keys, values) {
		const newArray = {};
		let i = 0;
		if (typeof keys !== 'object') {
			return false;
		}
		if (typeof values !== 'object') {
			return false;
		}
		if (typeof keys.length !== 'number') {
			return false;
		}
		if (typeof values.length !== 'number') {
			return false;
		}
		if (!keys.length) {
			return false;
		}
		if (keys.length !== values.length) {
			return false;
		}
		for (i = 0; i < keys.length; i++) {
			const value = values[i];
			if (typeof value === 'undefined') {
				return false;
			}
			newArray[String(keys[i])] = value;
		}
		return newArray;
	}

	function array_count_values(array) {
		const tmpArr = {};
		const _countValue = function(target, value) {
			let normalized = '';
			if (typeof value === 'number') {
				if (Math.floor(value) !== value) {
					return;
				}
				normalized = String(value);
			} else if (typeof value !== 'string') {
				return;
			} else {
				normalized = value;
			}
			if (normalized in target && Object.hasOwn(target, normalized)) {
				target[normalized] = (target[normalized] ?? 0) + 1;
			} else {
				target[normalized] = 1;
			}
		};
		if (!isObjectLike(array)) {
			return tmpArr;
		}
		const source = toPhpArrayObject(array);
		for (const value of Object.values(source)) {
			_countValue(tmpArr, value);
		}
		return tmpArr;
	}

	function array_diff(arr1, ...arrays) {
		const retArr = {};
		if (arrays.length < 1) {
			return retArr;
		}
		const arr1Object = toPhpArrayObject(arr1);
		arr1keys: for (const [k1, arr1Value] of entriesOfPhpAssoc(arr1Object)) {
			for (const nextArray of arrays) {
				const arr = toPhpArrayObject(nextArray);
				for (const [, value] of entriesOfPhpAssoc(arr)) {
					if (value === arr1Value) {
						continue arr1keys;
					}
				}
			}
			retArr[k1] = arr1Value;
		}
		return retArr;
	}

	function array_diff_assoc(arr1, ...arrays) {
		const retArr = {};
		if (arrays.length < 1) {
			return retArr;
		}
		const arr1Object = toPhpArrayObject(arr1);
		arr1keys: for (const [k1, arr1Value] of entriesOfPhpAssoc(arr1Object)) {
			for (const nextArray of arrays) {
				const arr = toPhpArrayObject(nextArray);
				for (const [k, value] of entriesOfPhpAssoc(arr)) {
					if (value === arr1Value && k === k1) {
						continue arr1keys;
					}
				}
			}
			retArr[k1] = arr1Value;
		}
		return retArr;
	}

	function array_diff_key(arr1, ...arrays) {
		const retArr = {};
		if (arrays.length < 1) {
			return retArr;
		}
		const arr1Object = toPhpArrayObject(arr1);
		arr1keys: for (const [k1, arr1Value] of entriesOfPhpAssoc(arr1Object)) {
			for (const nextArray of arrays) {
				const arr = toPhpArrayObject(nextArray);
				for (const [k] of entriesOfPhpAssoc(arr)) {
					if (k === k1) {
						continue arr1keys;
					}
				}
			}
			retArr[k1] = arr1Value;
		}
		return retArr;
	}

	function array_diff_uassoc(arr1, ...arraysAndCallback) {
		const retArr = {};
		const callback = arraysAndCallback.at(-1);
		if (typeof callback === 'undefined' || !isPhpCallableDescriptor(callback)) {
			throw new Error('array_diff_uassoc(): Invalid callback');
		}
		const arrays = arraysAndCallback.slice(0, -1).map((value => toPhpArrayObject(value)));
		const keyComparator = resolveNumericComparator(callback, 'array_diff_uassoc(): Invalid callback');
		arr1keys: for (const [k1, arr1Value] of entriesOfPhpAssoc(arr1)) {
			for (const arr of arrays) {
				for (const [k, arrValue] of entriesOfPhpAssoc(arr)) {
					if (arrValue === arr1Value && keyComparator(k, k1) === 0) {
						continue arr1keys;
					}
				}
			}
			retArr[k1] = arr1Value;
		}
		return retArr;
	}

	function array_diff_ukey(arr1, ...arraysAndCallback) {
		const retArr = {};
		const callback = arraysAndCallback.at(-1);
		if (typeof callback === 'undefined' || !isPhpCallableDescriptor(callback)) {
			throw new Error('array_diff_ukey(): Invalid callback');
		}
		const arrays = arraysAndCallback.slice(0, -1).map((value => toPhpArrayObject(value)));
		const keyComparator = resolveNumericComparator(callback, 'array_diff_ukey(): Invalid callback');
		arr1keys: for (const [k1, arr1Value] of entriesOfPhpAssoc(arr1)) {
			for (const arr of arrays) {
				for (const [k] of entriesOfPhpAssoc(arr)) {
					if (keyComparator(k, k1) === 0) {
						continue arr1keys;
					}
				}
			}
			retArr[k1] = arr1Value;
		}
		return retArr;
	}

	function array_fill(startIndex, num, mixedVal) {
		const tmpArr = {};
		if (!isNaN(startIndex) && !isNaN(num)) {
			for (let key = 0; key < num; key++) {
				tmpArr[String(key + startIndex)] = mixedVal;
			}
		}
		return tmpArr;
	}

	function array_fill_keys(keys, value) {
		const retObj = {};
		const keyedValues = toPhpArrayObject(keys);
		for (const keyedValue of Object.values(keyedValues)) {
			retObj[String(keyedValue)] = value;
		}
		return retObj;
	}

	function array_filter(arr, func) {
		const callback = func || (v => v);
		if (Array.isArray(arr)) {
			const filtered = [];
			for (const [key, value] of Object.entries(arr)) {
				const numericKey = Number(key);
				if (Reflect.apply(callback, undefined, [value, numericKey])) {
					filtered[numericKey] = value;
				}
			}
			return filtered;
		}
		const filtered = {};
		for (const [key, value] of Object.entries(arr)) {
			if (Reflect.apply(callback, undefined, [value, key])) {
				filtered[key] = value;
			}
		}
		return filtered;
	}

	function array_flip(trans) {
		const tmpArr = {};
		const values = toPhpArrayObject(trans);
		for (const [key, value] of Object.entries(values)) {
			tmpArr[String(value)] = key;
		}
		return tmpArr;
	}

	function array_intersect(arr1, ...arrays) {
		const retArr = {};
		if (arrays.length < 1) {
			return retArr;
		}
		const arr1Object = toPhpArrayObject(arr1);
		arr1keys: for (const [k1, arr1Value] of entriesOfPhpAssoc(arr1Object)) {
			for (const nextArray of arrays) {
				const arr = toPhpArrayObject(nextArray);
				let found = false;
				for (const [, value] of entriesOfPhpAssoc(arr)) {
					if (value === arr1Value) {
						found = true;
						break;
					}
				}
				if (!found) {
					continue arr1keys;
				}
			}
			retArr[k1] = arr1Value;
		}
		return retArr;
	}

	function array_intersect_assoc(arr1, ...arrays) {
		const retArr = {};
		if (arrays.length < 1) {
			return retArr;
		}
		const arr1Object = toPhpArrayObject(arr1);
		arr1keys: for (const [k1, arr1Value] of entriesOfPhpAssoc(arr1Object)) {
			for (const nextArray of arrays) {
				const arr = toPhpArrayObject(nextArray);
				if (arr[k1] !== arr1Value) {
					continue arr1keys;
				}
			}
			retArr[k1] = arr1Value;
		}
		return retArr;
	}

	function array_intersect_key(arr1, ...arrays) {
		const retArr = {};
		if (arrays.length < 1) {
			return retArr;
		}
		const arr1Object = toPhpArrayObject(arr1);
		const keySets = arrays.map((nextArray => new Set(Object.keys(toPhpArrayObject(nextArray)))));
		for (const [k1, arr1Value] of Object.entries(arr1Object)) {
			if (keySets.every((keys => keys.has(k1)))) {
				retArr[k1] = arr1Value;
			}
		}
		return retArr;
	}

	function array_intersect_uassoc(arr1, ...arraysAndCallback) {
		const retArr = {};
		const callback = arraysAndCallback.at(-1);
		if (typeof callback === 'undefined' || !isPhpCallableDescriptor(callback)) {
			throw new Error('array_intersect_uassoc(): Invalid callback');
		}
		const arrays = arraysAndCallback.slice(0, -1).map((value => toPhpArrayObject(value)));
		const lastArrayIndex = arrays.length - 1;
		const keyComparator = resolveNumericComparator(callback, 'array_intersect_uassoc(): Invalid callback');
		arr1keys: for (const [k1, arr1Value] of entriesOfPhpAssoc(arr1)) {
			arrs: for (const [i, arr] of arrays.entries()) {
				for (const [k, arrValue] of entriesOfPhpAssoc(arr)) {
					if (arrValue === arr1Value && keyComparator(k, k1) === 0) {
						if (i === lastArrayIndex) {
							retArr[k1] = arr1Value;
						}
						continue arrs;
					}
				}
				continue arr1keys;
			}
		}
		return retArr;
	}

	function array_intersect_ukey(arr1, ...arraysAndCallback) {
		const retArr = {};
		const callback = arraysAndCallback.at(-1);
		if (typeof callback === 'undefined' || !isPhpCallableDescriptor(callback)) {
			throw new Error('array_intersect_ukey(): Invalid callback');
		}
		const arrays = arraysAndCallback.slice(0, -1).map((value => toPhpArrayObject(value)));
		const lastArrayIndex = arrays.length - 1;
		const keyComparator = resolveNumericComparator(callback, 'array_intersect_ukey(): Invalid callback');
		arr1keys: for (const [k1, arr1Value] of entriesOfPhpAssoc(arr1)) {
			arrs: for (const [i, arr] of arrays.entries()) {
				for (const [k] of entriesOfPhpAssoc(arr)) {
					if (keyComparator(k, k1) === 0) {
						if (i === lastArrayIndex) {
							retArr[k1] = arr1Value;
						}
						continue arrs;
					}
				}
				continue arr1keys;
			}
		}
		return retArr;
	}

	function array_is_list(input) {
		const keys = Object.keys(input);
		for (let i = 0; i < keys.length; i++) {
			if (normalizeArrayKey(keys[i] ?? '') !== i) {
				return false;
			}
		}
		return true;
	}

	function array_key_exists(key, search) {
		return String(key) in search;
	}

	function array_key_first(input) {
		const [firstKey] = Object.keys(input);
		return typeof firstKey === 'string' ? normalizeArrayKey(firstKey) : null;
	}

	function array_key_last(input) {
		const keys = Object.keys(input);
		const lastKey = keys.at(-1);
		return typeof lastKey === 'string' ? normalizeArrayKey(lastKey) : null;
	}

	function array_keys(input, searchValue, argStrict) {
		if (!arguments.length) {
			throw new Error('array_keys() expects at least 1 parameter, 0 given');
		}
		if(typeof input === 'undefined'){
			input = [];
		}
		if (typeof input !== 'object' || input === null) {
			throw new TypeError(`array_keys(): Argument #1 ($array) must be of type array.`);
		}
		const search = typeof searchValue !== 'undefined';
		const tmpArr = [];
		const strict = !!argStrict;
		let include = true;
		for (const [key, value] of Object.entries(input)) {
			include = true;
			if (search) {
				if (strict && value !== searchValue) {
					include = false;
				} else if (value !== searchValue) {
					include = false;
				}
			}
			if (include) {
				tmpArr.push(normalizeArrayKey(key));
			}
		}
		return tmpArr;
	}

	function array_map(callback, ...inputArrays) {
		const argc = inputArrays.length + 1;
		const itemCount = inputArrays[0]?.length ?? 0;
		const resolved = callback === null || typeof callback === 'undefined' ? null : resolvePhpCallable(callback, {
			'invalidMessage': 'array_map(): Invalid callback',
			'missingScopeMessage': scopeName => 'Object not found: ' + scopeName
		});
		if (resolved) {
			const mapped = [];
			for (let itemIndex = 0; itemIndex < itemCount; itemIndex++) {
				const args = [];
				for (let arrayIndex = 0; arrayIndex < argc - 1; arrayIndex++) {
					args.push(inputArrays[arrayIndex]?.[itemIndex]);
				}
				mapped[itemIndex] = resolved.fn.apply(resolved.scope, args);
			}
			return mapped;
		}
		const mapped = [];
		for (let itemIndex = 0; itemIndex < itemCount; itemIndex++) {
			const args = [];
			for (let arrayIndex = 0; arrayIndex < argc - 1; arrayIndex++) {
				args.push(inputArrays[arrayIndex]?.[itemIndex]);
			}
			mapped[itemIndex] = args;
		}
		return mapped;
	}

	function array_merge(...args) {
		const retObj = {};
		let retArr = true;
		for (const arg of args) {
			if (!Array.isArray(arg)) {
				retArr = false;
				break;
			}
		}
		if (retArr) {
			let merged = [];
			for (const arg of args) {
				if (Array.isArray(arg)) {
					merged = merged.concat(arg);
				}
			}
			return merged;
		}
		for (let ct = 0, i = 0; i < args.length; i++) {
			const arg = args[i];
			if (typeof arg === 'undefined') {
				continue;
			}
			if (Array.isArray(arg)) {
				for (let j = 0, argil = arg.length; j < argil; j++) {
					const value = arg[j];
					if (typeof value !== 'undefined') {
						retObj[ct++] = value;
					}
				}
			} else {
				for (const [k, value] of Object.entries(arg)) {
					if (typeof value === 'undefined') {
						continue;
					}
					if (parseInt(k, 10) + '' === k) {
						retObj[ct++] = value;
					} else {
						retObj[k] = value;
					}
				}
			}
		}
		return retObj;
	}

	function mergeInto(result, source) {
		let numericIdx = Object.keys(result).filter((key => parseInt(key, 10) + '' === key + '')).length;
		const isNumericKey = function(key) {
			return parseInt(key, 10) + '' === key + '';
		};
		const isPlainObject = function(val) {
			return isObjectLike(val) && !Array.isArray(val);
		};
		for (const [key, sourceValue] of Object.entries(source)) {
			if (isNumericKey(key)) {
				result[numericIdx++] = sourceValue;
			} else if (key in result) {
				const resultValue = result[key];
				if (isPlainObject(resultValue) && isPlainObject(sourceValue)) {
					result[key] = array_merge_recursive(resultValue, sourceValue);
				} else if (Array.isArray(resultValue)) {
					resultValue.push(sourceValue);
				} else {
					result[key] = [resultValue, sourceValue];
				}
			} else {
				result[key] = sourceValue;
			}
		}
	}

	function array_merge_recursive(...arrays) {
		if (arrays.length === 0) {
			return {};
		}
		const result = {};
		for (const array of arrays) {
			mergeInto(result, array);
		}
		return result;
	}
	const flags = {
		'SORT_REGULAR': 16,
		'SORT_NUMERIC': 17,
		'SORT_STRING': 18,
		'SORT_ASC': 32,
		'SORT_DESC': 40
	};
	const isSortableObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);
	const isSortFlag = value => typeof value === 'string' && value in flags;
	const isComparablePrimitive = value => typeof value === 'string' || typeof value === 'number' || typeof value === 'bigint' || typeof value === 'boolean' || value instanceof Date;
	const copyBackToObject = (target, values, keys) => {
		for (const key in target) {
			if (Object.hasOwn(target, key)) {
				delete target[key];
			}
		}
		for (let index = 0; index < values.length; index++) {
			const key = keys[index];
			if (key === undefined) {
				continue;
			}
			target[key] = values[index];
		}
	};
	const compareRegular = (leftValue, rightValue) => {
		if (leftValue === rightValue) {
			return 0;
		}
		if (leftValue === null || leftValue === undefined) {
			return -1;
		}
		if (rightValue === null || rightValue === undefined) {
			return 1;
		}
		if (isComparablePrimitive(leftValue) && isComparablePrimitive(rightValue)) {
			return leftValue > rightValue ? 1 : -1;
		}
		const left = String(leftValue);
		const right = String(rightValue);
		return left > right ? 1 : left < right ? -1 : 0;
	};

	function array_multisort(arr, ...rest) {
		let i = 0;
		let j = 0;
		let l = 0;
		let sal = 0;
		let vkey = '';
		let elIndex = 0;
		let zlast;
		const sortFlag = [0];
		const thingsToSort = [];
		let nLastSort = [];
		let lastSort = [];
		const args = [arr, ...rest];
		const sortDuplicator = function() {
			return nLastSort.shift() ?? 0;
		};
		const sortFunctions = [
			[function(a, b) {
				const result = compareRegular(a, b);
				lastSort.push(result);
				return result;
			}, function(a, b) {
				const result = compareRegular(b, a);
				lastSort.push(result);
				return result;
			}],
			[function(a, b) {
				const result = Number(a) - Number(b);
				lastSort.push(result);
				return result;
			}, function(a, b) {
				const result = Number(b) - Number(a);
				lastSort.push(result);
				return result;
			}],
			[function(a, b) {
				const left = String(a);
				const right = String(b);
				const result = left > right ? 1 : left < right ? -1 : 0;
				lastSort.push(result);
				return result;
			}, function(a, b) {
				const left = String(b);
				const right = String(a);
				const result = left > right ? 1 : left < right ? -1 : 0;
				lastSort.push(result);
				return result;
			}]
		];
		const sortArrs = [
			[]
		];
		const sortKeys = [
			[]
		];
		if (Array.isArray(arr)) {
			sortArrs[0] = arr;
		} else if (isSortableObject(arr)) {
			const firstSortKeys = sortKeys[0];
			const firstSortValues = sortArrs[0];
			if (!firstSortKeys || !firstSortValues) {
				return false;
			}
			for (const key in arr) {
				if (Object.hasOwn(arr, key)) {
					firstSortKeys.push(key);
					firstSortValues.push(arr[key]);
				}
			}
		} else {
			return false;
		}
		const primarySortArray = sortArrs[0];
		if (!primarySortArray) {
			return false;
		}
		const arrMainLength = primarySortArray.length;
		let sortComponents = [0, arrMainLength];
		const argl = args.length;
		for (j = 1; j < argl; j++) {
			const arg = args[j];
			if (Array.isArray(arg)) {
				sortArrs[j] = arg;
				sortFlag[j] = 0;
				if (arg.length !== arrMainLength) {
					return false;
				}
			} else if (isSortableObject(arg)) {
				const currentSortKeys = sortKeys[j] = [];
				const currentSortValues = sortArrs[j] = [];
				sortFlag[j] = 0;
				for (const key in arg) {
					if (Object.hasOwn(arg, key)) {
						currentSortKeys.push(key);
						currentSortValues.push(arg[key]);
					}
				}
				if (currentSortValues.length !== arrMainLength) {
					return false;
				}
			} else if (typeof arg === 'string') {
				if (!isSortFlag(arg)) {
					return false;
				}
				const lFlag = sortFlag.pop() ?? 0;
				if ((flags[arg] >>> 4 & lFlag >>> 4) > 0) {
					return false;
				}
				sortFlag.push(lFlag + flags[arg]);
			} else {
				return false;
			}
		}
		for (i = 0; i !== arrMainLength; i++) {
			thingsToSort.push(true);
		}
		for (const iKey in sortArrs) {
			if (Object.hasOwn(sortArrs, iKey)) {
				const iNum = Number(iKey);
				const lastSorts = [];
				let tmpArray = [];
				elIndex = 0;
				nLastSort = [];
				lastSort = [];
				const currentSortArr = sortArrs[iNum];
				if (!currentSortArr) {
					continue;
				}
				if (sortComponents.length === 0) {
					const arg = args[iNum];
					if (Array.isArray(arg)) {
						args[iNum] = currentSortArr;
					} else if (isSortableObject(arg)) {
						const currentSortKeySet = sortKeys[iNum] ?? [];
						sal = currentSortArr.length;
						for (j = 0, vkey = ''; j < sal; j++) {
							vkey = currentSortKeySet[j] ?? '';
							if (vkey !== '') {
								arg[vkey] = currentSortArr[j];
							}
						}
					}
					sortArrs.splice(iNum, 1);
					sortKeys.splice(iNum, 1);
					continue;
				}
				const currentSortFlag = sortFlag[iNum] ?? 0;
				const functionGroup = sortFunctions[currentSortFlag & 3];
				if (!functionGroup) {
					return false;
				}
				let sFunction = functionGroup[(currentSortFlag & 8) > 0 ? 1 : 0] ?? functionGroup[0];
				for (l = 0; l !== sortComponents.length; l += 2) {
					const componentStart = sortComponents[l];
					const componentEnd = sortComponents[l + 1];
					if (componentStart === undefined || componentEnd === undefined) {
						continue;
					}
					tmpArray = currentSortArr.slice(componentStart, componentEnd + 1);
					tmpArray.sort(sFunction);
					lastSorts[l] = [...lastSort];
					elIndex = componentStart;
					for (const value of tmpArray) {
						currentSortArr[elIndex] = value;
						elIndex++;
					}
				}
				sFunction = sortDuplicator;
				for (const jKey in sortArrs) {
					if (Object.hasOwn(sortArrs, jKey)) {
						const jNum = Number(jKey);
						const targetSortArr = sortArrs[jNum];
						if (!targetSortArr || targetSortArr === currentSortArr) {
							continue;
						}
						for (l = 0; l !== sortComponents.length; l += 2) {
							const componentStart = sortComponents[l];
							const componentEnd = sortComponents[l + 1];
							if (componentStart === undefined || componentEnd === undefined) {
								continue;
							}
							tmpArray = targetSortArr.slice(componentStart, componentEnd + 1);
							nLastSort = [...lastSorts[l] ?? []];
							tmpArray.sort(sFunction);
							elIndex = componentStart;
							for (const value of tmpArray) {
								targetSortArr[elIndex] = value;
								elIndex++;
							}
						}
					}
				}
				for (const jKey in sortKeys) {
					if (Object.hasOwn(sortKeys, jKey)) {
						const jNum = Number(jKey);
						const targetSortKeys = sortKeys[jNum];
						if (!targetSortKeys) {
							continue;
						}
						for (l = 0; l !== sortComponents.length; l += 2) {
							const componentStart = sortComponents[l];
							const componentEnd = sortComponents[l + 1];
							if (componentStart === undefined || componentEnd === undefined) {
								continue;
							}
							tmpArray = targetSortKeys.slice(componentStart, componentEnd + 1);
							nLastSort = [...lastSorts[l] ?? []];
							tmpArray.sort(sFunction);
							elIndex = componentStart;
							for (const value of tmpArray) {
								targetSortKeys[elIndex] = String(value);
								elIndex++;
							}
						}
					}
				}
				zlast = null;
				sortComponents = [];
				let lastIndex = 0;
				for (let idx = 0; idx < currentSortArr.length; idx++) {
					lastIndex = idx;
					if (!thingsToSort[idx]) {
						if (sortComponents.length & 1) {
							sortComponents.push(idx - 1);
						}
						zlast = null;
						continue;
					}
					if (!(sortComponents.length & 1)) {
						if (zlast !== null) {
							if (currentSortArr[idx] === zlast) {
								sortComponents.push(idx - 1);
							} else {
								thingsToSort[idx] = false;
							}
						}
						zlast = currentSortArr[idx];
					} else if (currentSortArr[idx] !== zlast) {
						sortComponents.push(idx - 1);
						zlast = currentSortArr[idx];
					}
				}
				if (sortComponents.length & 1) {
					sortComponents.push(lastIndex);
				}
				const arg = args[iNum];
				if (Array.isArray(arg)) {
					args[iNum] = currentSortArr;
				} else if (isSortableObject(arg)) {
					copyBackToObject(arg, currentSortArr, sortKeys[iNum] ?? []);
				}
				sortArrs.splice(iNum, 1);
				sortKeys.splice(iNum, 1);
			}
		}
		return true;
	}

	function array_pad(input, padSize, padValue) {
		let pad = [];
		const newArray = [];
		let newLength = 0;
		let diff = 0;
		let i = 0;
		if (Array.isArray(input) && !Number.isNaN(padSize)) {
			newLength = padSize < 0 ? padSize * -1 : padSize;
			diff = newLength - input.length;
			if (diff > 0) {
				for (i = 0; i < diff; i++) {
					newArray[i] = padValue;
				}
				pad = padSize < 0 ? [...newArray, ...input] : [...input, ...newArray];
			} else {
				pad = input;
			}
		}
		return pad;
	}

	function array_pop(inputArr) {
		let key = '';
		let lastKey = '';
		if (Array.isArray(inputArr)) {
			if (!inputArr.length) {
				return null;
			}
			return inputArr.pop() ?? null;
		} else {
			for (key in inputArr) {
				if (inputArr.hasOwnProperty(key)) {
					lastKey = key;
				}
			}
			if (lastKey) {
				const tmp = inputArr[lastKey];
				if (tmp === undefined) {
					return null;
				}
				delete inputArr[lastKey];
				return tmp;
			} else {
				return null;
			}
		}
	}

	function array_product(input) {
		let idx = 0;
		let product = 1;
		let il = 0;
		if (!Array.isArray(input)) {
			return null;
		}
		il = input.length;
		while (idx < il) {
			const numeric = Number(input[idx]);
			product *= Number.isNaN(numeric) ? 0 : numeric;
			idx++;
		}
		return product;
	}

	function array_push(inputArr, ...values) {
		const allDigits = /^\d+$/;
		let size = 0;
		let highestIdx = 0;
		let len = 0;
		if (Array.isArray(inputArr)) {
			for (const value of values) {
				inputArr.push(value);
			}
			return inputArr.length;
		}
		const target = toPhpArrayObject(inputArr);
		for (const pr of Object.keys(target)) {
			++len;
			if (allDigits.test(pr)) {
				size = parseInt(pr, 10);
				highestIdx = size > highestIdx ? size : highestIdx;
			}
		}
		for (const value of values) {
			target[++highestIdx] = value;
		}
		return len + values.length;
	}

	function array_rand(array, num) {
		const keys = Object.keys(array);
		if (typeof num === 'undefined' || num === null) {
			num = 1;
		} else {
			num = +num;
		}
		if (isNaN(num) || num < 1 || num > keys.length) {
			return null;
		}
		for (let i = keys.length - 1; i > 0; i--) {
			const j = Math.floor(Math.random() * (i + 1));
			const tmp = keys[j];
			const current = keys[i];
			if (tmp === undefined || current === undefined) {
				return null;
			}
			keys[j] = current;
			keys[i] = tmp;
		}
		return num === 1 ? keys[0] ?? null : keys.slice(0, num);
	}

	function array_reduce(aInput, callback, initial) {
		let carry = typeof initial === 'undefined' ? null : initial;
		for (const value of aInput) {
			carry = callback(carry, value);
		}
		return carry;
	}

	function array_replace(arr, firstReplacement, ...additionalReplacements) {
		const retObj = {};
		const arrObject = toPhpArrayObject(arr);
		for (const p in arrObject) {
			retObj[p] = arrObject[p];
		}
		for (const replacement of [firstReplacement, ...additionalReplacements]) {
			if (!isObjectLike(replacement)) {
				continue;
			}
			const current = toPhpArrayObject(replacement);
			for (const p in current) {
				retObj[p] = current[p];
			}
		}
		return retObj;
	}
	const cloneReplaceTarget = value => {
		if (Array.isArray(value)) {
			return [...value];
		}
		return {
			...value
		};
	};

	function array_replace_recursive(arr, ...replacements) {
		if (replacements.length < 1) {
			throw new Error('There should be at least 2 arguments passed to array_replace_recursive()');
		}
		const retObj = cloneReplaceTarget(arr);
		const retObjLike = toPhpArrayObject(retObj);
		for (const replacement of replacements) {
			const replacementObj = toPhpArrayObject(replacement);
			for (const p in replacementObj) {
				if (isObjectLike(retObjLike[p]) && isObjectLike(replacementObj[p])) {
					retObjLike[p] = array_replace_recursive(toPhpArrayObject(retObjLike[p]), toPhpArrayObject(replacementObj[p]));
				} else {
					retObjLike[p] = replacementObj[p];
				}
			}
		}
		return retObj;
	}

	function array_reverse(array, preserveKeys) {
		const preserve = preserveKeys === true;
		let result;
		if (Array.isArray(array) && !preserve) {
			result = array.slice(0).reverse();
		} else {
			const source = toPhpArrayObject(array);
			if (preserve) {
				const keys = Object.keys(source);
				const reversed = {};
				for (let index = keys.length - 1; index >= 0; index -= 1) {
					const key = keys[index];
					if (typeof key === 'string') {
						reversed[key] = source[key];
					}
				}
				result = reversed;
			} else {
				result = Object.values(source).reverse();
			}
		}
		return result;
	}

	function array_search(needle, haystack, argStrict) {
		const strict = Boolean(argStrict);
		if (needle instanceof RegExp) {
			let regex = needle;
			if (!strict) {
				const flags = 'i' + (needle.global ? 'g' : '') + (needle.multiline ? 'm' : '') + (needle.sticky ? 'y' : '');
				regex = new RegExp(needle.source, flags);
			}
			for (const [key, value] of Object.entries(haystack)) {
				if (regex.test(String(value))) {
					return key;
				}
			}
			return false;
		}
		for (const [key, value] of Object.entries(haystack)) {
			if (strict && value === needle || !strict && value == needle) {
				return key;
			}
		}
		return false;
	}

	function array_shift(inputArr) {
		if (inputArr.length === 0) {
			return null;
		}
		if (inputArr.length > 0) {
			return inputArr.shift() ?? null;
		}
		return null;
	}

	function array_slice(arr, offst, lgth, preserveKeys) {
		const preserve = preserveKeys === true;
		let result;
		if (Array.isArray(arr) && !(preserve && offst !== 0)) {
			if (lgth === undefined) {
				result = arr.slice(offst);
			} else if (lgth >= 0) {
				result = arr.slice(offst, offst + lgth);
			} else {
				result = arr.slice(offst, lgth);
			}
		} else {
			const sourceAssoc = {};
			let sourceLength = 0;
			if (Array.isArray(arr)) {
				for (let index = 0; index < arr.length; index += 1) {
					sourceLength += 1;
					sourceAssoc[String(index)] = arr[index];
				}
			} else {
				for (const key in arr) {
					sourceLength += 1;
					sourceAssoc[key] = arr[key];
				}
			}
			const normalizedOffset = offst < 0 ? sourceLength + offst : offst;
			const resolvedLength = lgth === undefined ? sourceLength : lgth < 0 ? sourceLength + lgth - normalizedOffset : lgth;
			const sliced = {};
			let started = false;
			let sourceIndex = -1;
			let collected = 0;
			let sequentialKey = 0;
			for (const key in sourceAssoc) {
				sourceIndex += 1;
				if (collected >= resolvedLength) {
					break;
				}
				if (sourceIndex === normalizedOffset) {
					started = true;
				}
				if (!started) {
					continue;
				}
				collected += 1;
				if (isInt(key) && !preserve) {
					sliced[String(sequentialKey)] = sourceAssoc[key];
					sequentialKey += 1;
				} else {
					sliced[key] = sourceAssoc[key];
				}
			}
			result = sliced;
		}
		return result;
	}
	const isAssocArray = value => typeof value === 'object' && value !== null && !Array.isArray(value);
	const toReplacementItems = replacement => {
		if (typeof replacement === 'undefined') {
			return undefined;
		}
		if (Array.isArray(replacement)) {
			return replacement.slice();
		}
		if (isAssocArray(replacement)) {
			const values = [];
			for (const key in replacement) {
				values.push(replacement[key]);
			}
			return values;
		}
		return [replacement];
	};
	const checkToUpIndices = (assoc, cursor, key) => {
		if (assoc[String(cursor)] !== undefined) {
			const tmp = cursor;
			cursor += 1;
			if (cursor === Number.parseInt(key, 10)) {
				cursor += 1;
			}
			cursor = checkToUpIndices(assoc, cursor, key);
			assoc[String(cursor)] = assoc[String(tmp)];
			delete assoc[String(tmp)];
		}
		return cursor;
	};

	function array_splice(arr, offst, lgth, replacement) {
		const replacementItems = toReplacementItems(replacement);
		const sourceLength = Array.isArray(arr) ? arr.length : Object.keys(arr).length;
		const lengthToRemove = typeof lgth === 'undefined' ? offst >= 0 ? sourceLength - offst : -offst : lgth < 0 ? (offst >= 0 ? sourceLength - offst : -offst) + lgth : lgth;
		if (Array.isArray(arr)) {
			const arrayInput = arr;
			if (replacementItems) {
				return arrayInput.splice(offst, lengthToRemove, ...replacementItems);
			}
			return arrayInput.splice(offst, lengthToRemove);
		}
		let totalLength = 0;
		let indexCursor = -1;
		let replacementCursor = 0;
		let numericCursor = -1;
		let returnsArray = true;
		let removedNumericCursor = 0;
		const removedItems = [];
		const removedAssoc = {};
		const assoc = arr;
		for (const _key in assoc) {
			totalLength += 1;
		}
		const normalizedOffset = offst >= 0 ? offst : totalLength + offst;
		for (const key in assoc) {
			indexCursor += 1;
			if (indexCursor < normalizedOffset) {
				if (isInt(key)) {
					numericCursor += 1;
					if (Number.parseInt(key, 10) !== numericCursor) {
						checkToUpIndices(assoc, numericCursor, key);
						assoc[String(numericCursor)] = assoc[key];
						delete assoc[key];
					}
				}
				continue;
			}
			if (returnsArray && is_int(key)) {
				removedItems.push(assoc[key]);
				removedAssoc[String(removedNumericCursor)] = assoc[key];
				removedNumericCursor += 1;
			} else {
				removedAssoc[key] = assoc[key];
				returnsArray = false;
			}
			if (replacementItems && replacementCursor < replacementItems.length) {
				assoc[key] = replacementItems[replacementCursor];
				replacementCursor += 1;
			} else {
				delete assoc[key];
			}
		}
		return returnsArray ? removedItems : removedAssoc;
	}

	function array_sum(array) {
		let sum = 0;
		if (array === null || typeof array !== 'object') {
			return null;
		}
		const values = toPhpArrayObject(array);
		for (const value of Object.values(values)) {
			const parsed = parseFloat(String(value));
			if (!isNaN(parsed)) {
				sum += parsed;
			}
		}
		return sum;
	}

	function array_udiff(arr1, ...arraysAndCallback) {
		const retArr = {};
		const callback = arraysAndCallback.at(-1);
		if (typeof callback === 'undefined' || !isPhpCallableDescriptor(callback)) {
			throw new Error('array_udiff(): Invalid callback');
		}
		const arrays = arraysAndCallback.slice(0, -1).map((value => toPhpArrayObject(value)));
		const cb = resolveNumericComparator(callback, 'array_udiff(): Invalid callback');
		arr1keys: for (const [k1, arr1Value] of entriesOfPhpAssoc(arr1)) {
			for (const arr of arrays) {
				for (const [, arrValue] of entriesOfPhpAssoc(arr)) {
					if (cb(arrValue, arr1Value) === 0) {
						continue arr1keys;
					}
				}
			}
			retArr[k1] = arr1Value;
		}
		return retArr;
	}

	function array_udiff_assoc(arr1, ...arraysAndCallback) {
		const retArr = {};
		const callback = arraysAndCallback.at(-1);
		if (typeof callback === 'undefined' || !isPhpCallableDescriptor(callback)) {
			throw new Error('array_udiff_assoc(): Invalid callback');
		}
		const arrays = arraysAndCallback.slice(0, -1).map((value => toPhpArrayObject(value)));
		const cb = resolveNumericComparator(callback, 'array_udiff_assoc(): Invalid callback');
		arr1keys: for (const [k1, arr1Value] of entriesOfPhpAssoc(arr1)) {
			for (const arr of arrays) {
				for (const [k, arrValue] of entriesOfPhpAssoc(arr)) {
					if (cb(arrValue, arr1Value) === 0 && k === k1) {
						continue arr1keys;
					}
				}
			}
			retArr[k1] = arr1Value;
		}
		return retArr;
	}

	function array_udiff_uassoc(arr1, ...arraysAndComparators) {
		const retArr = {};
		const keyCallback = arraysAndComparators.at(-1);
		const valueCallback = arraysAndComparators.at(-2);
		if (typeof keyCallback === 'undefined' || typeof valueCallback === 'undefined' || !isPhpCallableDescriptor(keyCallback) || !isPhpCallableDescriptor(valueCallback)) {
			throw new Error('array_udiff_uassoc(): Invalid callback');
		}
		const arrays = arraysAndComparators.slice(0, -2).map((value => toPhpArrayObject(value)));
		const keyComparator = resolveNumericComparator(keyCallback, 'array_udiff_uassoc(): Invalid key callback');
		const valueComparator = resolveNumericComparator(valueCallback, 'array_udiff_uassoc(): Invalid value callback');
		arr1keys: for (const [k1, arr1Value] of entriesOfPhpAssoc(arr1)) {
			for (const arr of arrays) {
				for (const [k, arrValue] of entriesOfPhpAssoc(arr)) {
					if (valueComparator(arrValue, arr1Value) === 0 && keyComparator(k, k1) === 0) {
						continue arr1keys;
					}
				}
			}
			retArr[k1] = arr1Value;
		}
		return retArr;
	}

	function array_uintersect(arr1, ...arraysAndCallback) {
		const retArr = {};
		const callback = arraysAndCallback.at(-1);
		if (typeof callback === 'undefined' || !isPhpCallableDescriptor(callback)) {
			throw new Error('array_uintersect(): Invalid callback');
		}
		const arrays = arraysAndCallback.slice(0, -1).map((value => toPhpArrayObject(value)));
		const valueComparator = resolveNumericComparator(callback, 'array_uintersect(): Invalid callback');
		const lastArrayIndex = arrays.length - 1;
		arr1keys: for (const [k1, arr1Value] of entriesOfPhpAssoc(arr1)) {
			arrs: for (const [i, arr] of arrays.entries()) {
				for (const [, arrValue] of entriesOfPhpAssoc(arr)) {
					if (valueComparator(arrValue, arr1Value) === 0) {
						if (i === lastArrayIndex) {
							retArr[k1] = arr1Value;
						}
						continue arrs;
					}
				}
				continue arr1keys;
			}
		}
		return retArr;
	}

	function array_uintersect_uassoc(arr1, ...arraysAndComparators) {
		const retArr = {};
		const keyCallback = arraysAndComparators.at(-1);
		const valueCallback = arraysAndComparators.at(-2);
		if (typeof keyCallback === 'undefined' || typeof valueCallback === 'undefined' || !isPhpCallableDescriptor(keyCallback) || !isPhpCallableDescriptor(valueCallback)) {
			throw new Error('array_uintersect_uassoc(): Invalid callback');
		}
		const arrays = arraysAndComparators.slice(0, -2).map((value => toPhpArrayObject(value)));
		const lastArrayIndex = arrays.length - 1;
		const keyComparator = resolveNumericComparator(keyCallback, 'array_uintersect_uassoc(): Invalid key callback');
		const valueComparator = resolveNumericComparator(valueCallback, 'array_uintersect_uassoc(): Invalid value callback');
		arr1keys: for (const [k1, arr1Value] of entriesOfPhpAssoc(arr1)) {
			arrs: for (const [i, arr] of arrays.entries()) {
				for (const [k, arrValue] of entriesOfPhpAssoc(arr)) {
					if (valueComparator(arrValue, arr1Value) === 0 && keyComparator(k, k1) === 0) {
						if (i === lastArrayIndex) {
							retArr[k1] = arr1Value;
						}
						continue arrs;
					}
				}
				continue arr1keys;
			}
		}
		return retArr;
	}

	function array_unique(inputArr) {
		const tmpArr2 = {};
		const inputObj = toPhpArrayObject(inputArr);
		const _arraySearch = function(needle, haystack) {
			let fkey = '';
			for (fkey in haystack) {
				if (Object.hasOwn(haystack, fkey)) {
					if (String(haystack[fkey]) === String(needle)) {
						return fkey;
					}
				}
			}
			return false;
		};
		for (const [key, val] of entriesOfPhpAssoc(inputObj)) {
			if (_arraySearch(val, tmpArr2) === false) {
				tmpArr2[key] = val;
			}
		}
		return tmpArr2;
	}

	function array_unshift(array, ...values) {
		const reversedValues = values.slice().reverse();
		for (const value of reversedValues) {
			array.unshift(value);
		}
		return array.length;
	}
	
	function array_values(input) {
		if (!arguments.length) {
			throw new Error('array_values() expects at least 1 parameter, 0 given');
		}
		if(typeof input === 'undefined'){
			input = [];
		}
		if (typeof input !== 'object' || input === null) {
			throw new TypeError(`array_values(): Argument #1 ($array) must be of type array.`);
		}
		return Object.values(input);
	}

	function array_walk(array, funcname, userdata) {
		if (!array || typeof array !== 'object') {
			return false;
		}
		try {
			const hasUserdata = typeof userdata !== 'undefined';
			const callback = funcname;
			if (Array.isArray(array)) {
				for (const [index, value] of array.entries()) {
					if (hasUserdata) {
						Reflect.apply(callback, undefined, [value, index, userdata]);
					} else {
						Reflect.apply(callback, undefined, [value, index]);
					}
				}
				return true;
			}
			const target = toPhpArrayObject(array);
			for (const [key, value] of Object.entries(target)) {
				if (hasUserdata) {
					Reflect.apply(callback, undefined, [value, key, userdata]);
				} else {
					Reflect.apply(callback, undefined, [value, key]);
				}
			}
		} catch (_e) {
			return false;
		}
		return true;
	}

	function array_walk_recursive(array, funcname, userdata) {
		if (!isObjectLike(array)) {
			return false;
		}
		if (typeof funcname !== 'function') {
			return false;
		}
		const hasUserdata = typeof userdata !== 'undefined';
		const callCallback = (value, key) => {
			try {
				if (hasUserdata) {
					Reflect.apply(funcname, undefined, [value, key, userdata]);
				} else {
					Reflect.apply(funcname, undefined, [value, key]);
				}
				return true;
			} catch (_e) {
				return false;
			}
		};
		const walkList = list => {
			for (const [index, value] of list.entries()) {
				if (Array.isArray(value)) {
					if (!walkList(value)) {
						return false;
					}
					continue;
				}
				if (!callCallback(value, index)) {
					return false;
				}
			}
			return true;
		};
		const walkAssoc = assoc => {
			for (const [key, value] of Object.entries(assoc)) {
				if (Array.isArray(value)) {
					if (!walkList(value)) {
						return false;
					}
					continue;
				}
				if (!callCallback(value, key)) {
					return false;
				}
			}
			return true;
		};
		if (Array.isArray(array)) {
			return walkList(array);
		}
		return walkAssoc(toPhpArrayObject(array));
	}
	const isDenseArrayList = value => {
		const keys = Object.keys(value);
		return keys.length === value.length && keys.every(((key, index) => key === String(index)));
	};
	const setSortableEntry = (target, key, value) => {
		Object.defineProperty(target, key, {
			'value': value,
			'configurable': true,
			'enumerable': true,
			'writable': true
		});
	};
	const toSortablePrimitive = value => {
		if (typeof value === 'string' || typeof value === 'number' || typeof value === 'bigint' || typeof value === 'boolean') {
			return value;
		}
		return String(value ?? '');
	};

	function arsort(inputArr, sortFlags) {
		const runtime = ensurePhpRuntimeState();
		const valArr = [];
		const regularSortDesc = (leftValue, rightValue) => {
			const left = toSortablePrimitive(leftValue);
			const right = toSortablePrimitive(rightValue);
			return left < right ? 1 : left > right ? -1 : 0;
		};
		let sorter = regularSortDesc;
		switch (sortFlags) {
			case 'SORT_STRING':
				sorter = (a, b) => Number(strnatcmp(b, a) ?? 0);
				break;
			case 'SORT_LOCALE_STRING': {
				const locale = runtime.locales[runtime.locale_default];
				if (locale?.sorting) {
					const localeSorter = locale.sorting;
					sorter = (a, b) => localeSorter(b, a);
				}
				break;
			}
			case 'SORT_NUMERIC':
				sorter = (a, b) => Number(b) - Number(a);
				break;
			case 'SORT_REGULAR':
				sorter = regularSortDesc;
				break;
			default:
				sorter = regularSortDesc;
				break;
		}
		const iniVal = String(runtime.ini['locutus.sortByReference']?.local_value ?? '') || 'on';
		const sortByReference = iniVal === 'on';
		if (Array.isArray(inputArr) && isDenseArrayList(inputArr)) {
			const sortedValues = [...inputArr].sort(sorter);
			const target = sortByReference ? inputArr : [];
			if (sortByReference) {
				target.length = 0;
			}
			for (const value of sortedValues) {
				target.push(value);
			}
			return sortByReference ? true : target;
		}
		for (const [key, value] of Object.entries(inputArr)) {
			valArr.push([key, value]);
			if (sortByReference) {
				Reflect.deleteProperty(inputArr, key);
			}
		}
		valArr.sort(((a, b) => sorter(a[1], b[1])));
		const populateArr = sortByReference ? inputArr : Array.isArray(inputArr) ? [] : {};
		for (const [key, value] of valArr) {
			setSortableEntry(populateArr, key, value);
		}
		return sortByReference || populateArr;
	}

	function asort(inputArr, sortFlags) {
		const runtime = ensurePhpRuntimeState();
		const valArr = [];
		const regularSortAsc = (leftValue, rightValue) => {
			const left = toSortablePrimitive(leftValue);
			const right = toSortablePrimitive(rightValue);
			return left > right ? 1 : left < right ? -1 : 0;
		};
		let sorter = regularSortAsc;
		switch (sortFlags) {
			case 'SORT_STRING':
				sorter = (a, b) => Number(strnatcmp(a, b) ?? 0);
				break;
			case 'SORT_LOCALE_STRING': {
				const locale = runtime.locales[runtime.locale_default];
				if (locale?.sorting) {
					sorter = locale.sorting;
				}
				break;
			}
			case 'SORT_NUMERIC':
				sorter = (a, b) => Number(a) - Number(b);
				break;
			case 'SORT_REGULAR':
				sorter = regularSortAsc;
				break;
			default:
				sorter = regularSortAsc;
				break;
		}
		const iniVal = String(runtime.ini['locutus.sortByReference']?.local_value ?? '') || 'on';
		const sortByReference = iniVal === 'on';
		if (Array.isArray(inputArr) && isDenseArrayList(inputArr)) {
			const sortedValues = [...inputArr].sort(sorter);
			const target = sortByReference ? inputArr : [];
			if (sortByReference) {
				target.length = 0;
			}
			for (const value of sortedValues) {
				target.push(value);
			}
			return sortByReference ? true : target;
		}
		for (const [key, value] of Object.entries(inputArr)) {
			valArr.push([key, value]);
			if (sortByReference) {
				Reflect.deleteProperty(inputArr, key);
			}
		}
		valArr.sort(((a, b) => sorter(a[1], b[1])));
		const populateArr = sortByReference ? inputArr : Array.isArray(inputArr) ? [] : {};
		for (const [key, value] of valArr) {
			setSortableEntry(populateArr, key, value);
		}
		return sortByReference || populateArr;
	}
	const isCountable = value => {
		if (!value || typeof value !== 'object') {
			return false;
		}
		const valuePrototype = Object.getPrototypeOf(value);
		return valuePrototype === Array.prototype || valuePrototype === Object.prototype;
	};

	function count(mixedVar, mode = 0) {
		let cnt = 0;
		if (mixedVar === null || typeof mixedVar === 'undefined') {
			return 0;
		}
		if (typeof mixedVar !== 'object') {
			return 1;
		}
		const prototype = Object.getPrototypeOf(mixedVar);
		if (prototype !== Array.prototype && prototype !== Object.prototype) {
			return 1;
		}
		const recursiveMode = mode === 'COUNT_RECURSIVE' || mode === 1;
		if (Array.isArray(mixedVar)) {
			for (const key of Object.keys(mixedVar)) {
				cnt++;
				const value = mixedVar[Number(key)];
				if (recursiveMode && isCountable(value)) {
					cnt += count(value, 1);
				}
			}
			return cnt;
		}
		for (const value of Object.values(mixedVar)) {
			cnt++;
			if (recursiveMode && isCountable(value)) {
				cnt += count(value, 1);
			}
		}
		return cnt;
	}

	function current(arr) {
		const state = getPointerState(arr, true);
		if (!state) {
			return false;
		}
		const entry = getEntryAtCursor(arr, state.cursor);
		return entry ? entry[1] : false;
	}

	function end(arr) {
		const state = getPointerState(arr, true);
		if (!state) {
			return false;
		}
		const lastIndex = getArrayLikeLength(arr) - 1;
		if (lastIndex < 0) {
			return false;
		}
		const entry = getEntryAtCursor(arr, lastIndex);
		if (!entry) {
			return false;
		}
		state.setCursor(lastIndex);
		return entry[1];
	}

	function in_array(needle, haystack, argStrict) {
		const strict = !!argStrict;
		if (Array.isArray(haystack)) {
			if (strict) {
				for (const key in haystack) {
					if (haystack[Number(key)] === needle) {
						return true;
					}
				}
			} else {
				for (const key in haystack) {
					if (haystack[Number(key)] == needle) {
						return true;
					}
				}
			}
		} else if (strict) {
			for (const key in haystack) {
				if (haystack[key] === needle) {
					return true;
				}
			}
		} else {
			for (const key in haystack) {
				if (haystack[key] == needle) {
					return true;
				}
			}
		}
		return false;
	}

	function key(arr) {
		const state = getPointerState(arr, true);
		if (!state) {
			return false;
		}
		const entry = getEntryAtCursor(arr, state.cursor);
		return entry ? entry[0] : false;
	}

	function krsort(inputArr, sortFlags) {
		const tmpArr = {};
		const keys = [];
		let sorter;
		let i;
		let k;
		let sortByReference = false;
		let populateArr = {};
		const runtime = ensurePhpRuntimeState();
		switch (sortFlags) {
			case 'SORT_STRING':
				sorter = function(a, b) {
					return Number(strnatcmp(b, a) ?? 0);
				};
				break;
			case 'SORT_LOCALE_STRING': {
				const loc = runtime.locale_default;
				const locale = runtime.locales[loc];
				if (locale?.sorting) {
					sorter = locale.sorting;
				}
				break;
			}
			case 'SORT_NUMERIC':
				sorter = function(a, b) {
					return Number(b) - Number(a);
				};
				break;
			case 'SORT_REGULAR':
			default:
				sorter = function(b, a) {
					const aFloat = parseFloat(a);
					const bFloat = parseFloat(b);
					const aNumeric = aFloat + '' === a;
					const bNumeric = bFloat + '' === b;
					if (aNumeric && bNumeric) {
						return aFloat > bFloat ? 1 : aFloat < bFloat ? -1 : 0;
					} else if (aNumeric && !bNumeric) {
						return 1;
					} else if (!aNumeric && bNumeric) {
						return -1;
					}
					return a > b ? 1 : a < b ? -1 : 0;
				};
				break;
		}
		for (k in inputArr) {
			if (inputArr.hasOwnProperty(k)) {
				keys.push(k);
			}
		}
		keys.sort(sorter);
		const iniVal = String(runtime.ini['locutus.sortByReference']?.local_value ?? '') || 'on';
		sortByReference = iniVal === 'on';
		populateArr = sortByReference ? inputArr : populateArr;
		for (i = 0; i < keys.length; i++) {
			const keyName = keys[i];
			if (typeof keyName === 'undefined') {
				continue;
			}
			k = keyName;
			const value = inputArr[k];
			if (sortByReference) {
				delete inputArr[k];
			}
			if (typeof value === 'undefined') {
				continue;
			}
			tmpArr[k] = value;
		}
		for (const i in tmpArr) {
			if (tmpArr.hasOwnProperty(i)) {
				const value = tmpArr[i];
				if (typeof value === 'undefined') {
					continue;
				}
				populateArr[i] = value;
			}
		}
		return sortByReference || populateArr;
	}

	function ksort(inputArr, sortFlags) {
		const tmpArr = {};
		const keys = [];
		let sorter;
		let i;
		let k;
		let sortByReference = false;
		let populateArr = {};
		const runtime = ensurePhpRuntimeState();
		switch (sortFlags) {
			case 'SORT_STRING':
				sorter = function(a, b) {
					return Number(strnatcmp(b, a) ?? 0);
				};
				break;
			case 'SORT_LOCALE_STRING': {
				const loc = runtime.locale_default;
				const locale = runtime.locales[loc];
				if (locale?.sorting) {
					sorter = locale.sorting;
				}
				break;
			}
			case 'SORT_NUMERIC':
				sorter = function(a, b) {
					return Number(a) - Number(b);
				};
				break;
			default:
				sorter = function(a, b) {
					const aFloat = parseFloat(a);
					const bFloat = parseFloat(b);
					const aNumeric = aFloat + '' === a;
					const bNumeric = bFloat + '' === b;
					if (aNumeric && bNumeric) {
						return aFloat > bFloat ? 1 : aFloat < bFloat ? -1 : 0;
					} else if (aNumeric && !bNumeric) {
						return 1;
					} else if (!aNumeric && bNumeric) {
						return -1;
					}
					return a > b ? 1 : a < b ? -1 : 0;
				};
				break;
		}
		for (k in inputArr) {
			if (inputArr.hasOwnProperty(k)) {
				keys.push(k);
			}
		}
		keys.sort(sorter);
		const iniVal = String(runtime.ini['locutus.sortByReference']?.local_value ?? '') || 'on';
		sortByReference = iniVal === 'on';
		populateArr = sortByReference ? inputArr : populateArr;
		for (i = 0; i < keys.length; i++) {
			const keyName = keys[i];
			if (typeof keyName === 'undefined') {
				continue;
			}
			k = keyName;
			const value = inputArr[k];
			if (sortByReference) {
				delete inputArr[k];
			}
			if (typeof value === 'undefined') {
				continue;
			}
			tmpArr[k] = value;
		}
		for (const i in tmpArr) {
			if (tmpArr.hasOwnProperty(i)) {
				const value = tmpArr[i];
				if (typeof value === 'undefined') {
					continue;
				}
				populateArr[i] = value;
			}
		}
		return sortByReference || populateArr;
	}

	function natcasesort(inputArr) {
		const valArr = [];
		let k;
		let i;
		let sortByReference = false;
		let populateArr = {};
		const iniVal = ini_get('locutus.sortByReference') || 'on';
		sortByReference = iniVal === 'on';
		populateArr = sortByReference ? inputArr : populateArr;
		for (k in inputArr) {
			if (inputArr.hasOwnProperty(k)) {
				const value = inputArr[k];
				if (value === undefined) {
					continue;
				}
				valArr.push([k, value]);
				if (sortByReference) {
					delete inputArr[k];
				}
			}
		}
		valArr.sort((function(a, b) {
			return Number(strnatcasecmp(a[1], b[1]) ?? 0);
		}));
		for (i = 0; i < valArr.length; i++) {
			const pair = valArr[i];
			if (!pair) {
				continue;
			}
			populateArr[pair[0]] = pair[1];
		}
		return sortByReference || populateArr;
	}

	function natsort(inputArr) {
		const valArr = [];
		let k;
		let i;
		let sortByReference = false;
		let populateArr = {};
		const iniVal = ini_get('locutus.sortByReference') || 'on';
		sortByReference = iniVal === 'on';
		populateArr = sortByReference ? inputArr : populateArr;
		for (k in inputArr) {
			if (inputArr.hasOwnProperty(k)) {
				const value = inputArr[k];
				if (value === undefined) {
					continue;
				}
				valArr.push([k, value]);
				if (sortByReference) {
					delete inputArr[k];
				}
			}
		}
		valArr.sort((function(a, b) {
			return Number(strnatcmp(a[1], b[1]) ?? 0);
		}));
		for (i = 0; i < valArr.length; i++) {
			const pair = valArr[i];
			if (!pair) {
				continue;
			}
			populateArr[pair[0]] = pair[1];
		}
		return sortByReference || populateArr;
	}

	function next(arr) {
		const state = getPointerState(arr, true);
		if (!state) {
			return false;
		}
		const nextCursor = state.cursor + 1;
		const entry = getEntryAtCursor(arr, nextCursor);
		if (!entry) {
			return false;
		}
		state.setCursor(nextCursor);
		return entry[1];
	}

	function prev(arr) {
		const state = getPointerState(arr, false);
		if (!state || state.cursor === 0) {
			return false;
		}
		const previousCursor = state.cursor - 1;
		const entry = getEntryAtCursor(arr, previousCursor);
		if (!entry) {
			return false;
		}
		state.setCursor(previousCursor);
		return entry[1];
	}

	function range(low, high, step) {
		const matrix = [];
		let iVal;
		let endval;
		const walker = step || 1;
		let chars = false;
		const lowIsNumeric = !Number.isNaN(Number(low));
		const highIsNumeric = !Number.isNaN(Number(high));
		if (lowIsNumeric && highIsNumeric) {
			iVal = Number(low);
			endval = Number(high);
		} else if (!lowIsNumeric && !highIsNumeric) {
			chars = true;
			iVal = String(low).charCodeAt(0);
			endval = String(high).charCodeAt(0);
		} else {
			iVal = lowIsNumeric ? Number(low) : 0;
			endval = highIsNumeric ? Number(high) : 0;
		}
		const plus = !(iVal > endval);
		if (plus) {
			while (iVal <= endval) {
				matrix.push(chars ? String.fromCharCode(iVal) : iVal);
				iVal += walker;
			}
		} else {
			while (iVal >= endval) {
				matrix.push(chars ? String.fromCharCode(iVal) : iVal);
				iVal -= walker;
			}
		}
		return matrix;
	}

	function reset(arr) {
		const state = getPointerState(arr, true);
		if (!state) {
			return false;
		}
		const entry = getEntryAtCursor(arr, 0);
		if (!entry) {
			return false;
		}
		state.setCursor(0);
		return entry[1];
	}

	function rsort(inputArr, sortFlags) {
		const runtime = ensurePhpRuntimeState();
		const regularSortDesc = (leftValue, rightValue) => {
			const left = toSortablePrimitive(leftValue);
			const right = toSortablePrimitive(rightValue);
			return left < right ? 1 : left > right ? -1 : 0;
		};
		let sorter;
		switch (sortFlags) {
			case 'SORT_STRING':
				sorter = (a, b) => Number(strnatcmp(b, a) ?? 0);
				break;
			case 'SORT_LOCALE_STRING': {
				const locale = runtime.locales[runtime.locale_default];
				if (locale?.sorting) {
					sorter = locale.sorting;
				}
				break;
			}
			case 'SORT_NUMERIC':
				sorter = (a, b) => Number(b) - Number(a);
				break;
			case 'SORT_REGULAR':
				sorter = regularSortDesc;
				break;
			default:
				sorter = regularSortDesc;
				break;
		}
		const iniVal = String(runtime.ini['locutus.sortByReference']?.local_value ?? '') || 'on';
		const sortByReference = iniVal === 'on';
		const populateArr = sortByReference ? inputArr : {};
		const values = [];
		for (const [key, value] of Object.entries(inputArr)) {
			values.push(value);
			if (sortByReference) {
				delete inputArr[key];
			}
		}
		values.sort(sorter);
		for (const [index, value] of values.entries()) {
			populateArr[index] = value;
		}
		return sortByReference || populateArr;
	}

	function shuffle(inputArr) {
		const valArr = [];
		let k = '';
		let i = 0;
		let sortByReference = false;
		let populateArr = [];
		for (k in inputArr) {
			if (inputArr.hasOwnProperty(k)) {
				const value = inputArr[k];
				if (value === undefined) {
					continue;
				}
				valArr.push(value);
				if (sortByReference) {
					delete inputArr[k];
				}
			}
		}
		valArr.sort((function() {
			return 0.5 - Math.random();
		}));
		const iniVal = ini_get('locutus.sortByReference') || 'on';
		sortByReference = iniVal === 'on';
		populateArr = sortByReference ? inputArr : populateArr;
		for (i = 0; i < valArr.length; i++) {
			if (Array.isArray(populateArr)) {
				const value = valArr[i];
				if (value === undefined) {
					continue;
				}
				populateArr[i] = value;
			} else {
				const value = valArr[i];
				if (value === undefined) {
					continue;
				}
				populateArr[String(i)] = value;
			}
		}
		return sortByReference || populateArr;
	}

	function sort(inputArr, sortFlags) {
		const runtime = ensurePhpRuntimeState();
		const regularSortAsc = (leftValue, rightValue) => {
			const left = toSortablePrimitive(leftValue);
			const right = toSortablePrimitive(rightValue);
			return left > right ? 1 : left < right ? -1 : 0;
		};
		let sorter;
		switch (sortFlags) {
			case 'SORT_STRING':
				break;
			case 'SORT_LOCALE_STRING': {
				const locale = runtime.locales[runtime.locale_default];
				if (locale?.sorting) {
					sorter = locale.sorting;
				}
				break;
			}
			case 'SORT_NUMERIC':
				sorter = (a, b) => Number(a) - Number(b);
				break;
			case 'SORT_REGULAR':
				sorter = regularSortAsc;
				break;
			default:
				sorter = regularSortAsc;
				break;
		}
		const iniVal = String(runtime.ini['locutus.sortByReference']?.local_value ?? '') || 'on';
		const sortByReference = iniVal === 'on';
		const populateArr = sortByReference ? inputArr : {};
		const values = [];
		for (const [key, value] of Object.entries(inputArr)) {
			values.push(value);
			if (sortByReference) {
				delete inputArr[key];
			}
		}
		values.sort(sorter);
		for (const [index, value] of values.entries()) {
			populateArr[index] = value;
		}
		return sortByReference || populateArr;
	}

	function uasort(inputArr, sorter) {
		const valArr = [];
		let k = '';
		let i = 0;
		let sortByReference = false;
		let populateArr = {};
		const normalizedSorter = typeof sorter === 'string' ? [this, sorter] : sorter;
		let comparator;
		try {
			const resolved = resolvePhpCallable(normalizedSorter, {
				'invalidMessage': 'uasort(): Invalid callback',
				'missingScopeMessage': scopeName => 'Object not found: ' + scopeName
			});
			comparator = (a, b) => Number(resolved.fn.apply(resolved.scope, [a, b]));
		} catch (_error) {
			return false;
		}
		const runtime = ensurePhpRuntimeState();
		const iniVal = String(runtime.ini['locutus.sortByReference']?.local_value ?? '') || 'on';
		sortByReference = iniVal === 'on';
		populateArr = sortByReference ? inputArr : populateArr;
		for (k in inputArr) {
			if (inputArr.hasOwnProperty(k)) {
				const value = inputArr[k];
				if (typeof value !== 'undefined') {
					valArr.push([k, value]);
				}
				if (sortByReference) {
					delete inputArr[k];
				}
			}
		}
		if (typeof comparator !== 'function') {
			return false;
		}
		valArr.sort((function(a, b) {
			return comparator(a[1], b[1]);
		}));
		for (i = 0; i < valArr.length; i++) {
			const entry = valArr[i];
			if (!entry) {
				continue;
			}
			populateArr[entry[0]] = entry[1];
		}
		return sortByReference || populateArr;
	}

	function uksort(inputArr, sorter) {
		const tmpArr = {};
		const keys = [];
		let i = 0;
		let k = '';
		let sortByReference = false;
		let populateArr = {};
		let comparator;
		if (sorter) {
			let normalizedSorter;
			if (typeof sorter === 'string') {
				if (!global.window) {
					return false;
				}
				normalizedSorter = [global.window, sorter];
			} else if (Array.isArray(sorter)) {
				const [scopeDescriptor, callableDescriptor] = sorter;
				if (typeof callableDescriptor === 'undefined') {
					return false;
				}
				const scopeValue = typeof scopeDescriptor === 'string' ? global.window?.[scopeDescriptor] ?? global[scopeDescriptor] : scopeDescriptor;
				normalizedSorter = [scopeValue, callableDescriptor];
			} else {
				normalizedSorter = sorter;
			}
			try {
				const resolved = resolvePhpCallable(normalizedSorter, {
					'invalidMessage': 'uksort(): Invalid callback',
					'missingScopeMessage': scopeName => 'Object not found: ' + scopeName
				});
				comparator = (a, b) => Number(resolved.fn.apply(resolved.scope, [a, b]));
			} catch (_error) {
				return false;
			}
		}
		for (k in inputArr) {
			if (inputArr.hasOwnProperty(k)) {
				keys.push(k);
			}
		}
		try {
			if (typeof comparator === 'function') {
				keys.sort(comparator);
			} else {
				keys.sort();
			}
		} catch (_e) {
			return false;
		}
		const runtime = ensurePhpRuntimeState();
		const iniVal = String(runtime.ini['locutus.sortByReference']?.local_value ?? '') || 'on';
		sortByReference = iniVal === 'on';
		populateArr = sortByReference ? inputArr : populateArr;
		for (i = 0; i < keys.length; i++) {
			const key = keys[i];
			if (key === undefined) {
				continue;
			}
			k = key;
			const value = inputArr[k];
			if (value === undefined) {
				continue;
			}
			tmpArr[k] = value;
			if (sortByReference) {
				delete inputArr[k];
			}
		}
		for (const i in tmpArr) {
			if (tmpArr.hasOwnProperty(i)) {
				const value = tmpArr[i];
				if (value === undefined) {
					continue;
				}
				populateArr[i] = value;
			}
		}
		return sortByReference || populateArr;
	}

	function usort(inputArr, sorter) {
		const valArr = [];
		let k = '';
		let i = 0;
		let sortByReference = false;
		let populateArr = {};
		const normalizedSorter = typeof sorter === 'string' ? [this, sorter] : sorter;
		let comparator;
		try {
			const resolved = resolvePhpCallable(normalizedSorter, {
				'invalidMessage': 'usort(): Invalid callback',
				'missingScopeMessage': scopeName => 'Object not found: ' + scopeName
			});
			comparator = (a, b) => Number(resolved.fn.apply(resolved.scope, [a, b]));
		} catch (_error) {
			return false;
		}
		const runtime = ensurePhpRuntimeState();
		const iniVal = String(runtime.ini['locutus.sortByReference']?.local_value ?? '') || 'on';
		sortByReference = iniVal === 'on';
		populateArr = sortByReference ? inputArr : populateArr;
		for (k in inputArr) {
			if (inputArr.hasOwnProperty(k)) {
				const value = inputArr[k];
				if (typeof value !== 'undefined') {
					valArr.push(value);
				}
				if (sortByReference) {
					delete inputArr[k];
				}
			}
		}
		try {
			if (typeof comparator !== 'function') {
				return false;
			}
			valArr.sort(comparator);
		} catch (_e) {
			return false;
		}
		for (i = 0; i < valArr.length; i++) {
			const value = valArr[i];
			if (typeof value === 'undefined') {
				continue;
			}
			populateArr[i] = value;
		}
		return sortByReference || populateArr;
	}

	function bcadd(leftOperand, rightOperand, scale) {
		const libbcmath = _bc();
		let first;
		let second;
		let result;
		if (typeof scale === 'undefined') {
			scale = libbcmath.scale;
		}
		scale = scale < 0 ? 0 : scale;
		first = libbcmath.bc_init_num();
		second = libbcmath.bc_init_num();
		result = libbcmath.bc_init_num();
		first = libbcmath.php_str2num(leftOperand.toString());
		second = libbcmath.php_str2num(rightOperand.toString());
		result = libbcmath.bc_add(first, second, scale);
		if (result.n_scale > scale) {
			result.n_scale = scale;
		}
		return result.toString();
	}

	function bccomp(leftOperand, rightOperand, scale) {
		const libbcmath = _bc();
		if (typeof scale === 'undefined') {
			scale = libbcmath.scale;
		}
		scale = scale < 0 ? 0 : scale;
		let first = libbcmath.bc_init_num();
		let second = libbcmath.bc_init_num();
		first = libbcmath.bc_str2num(leftOperand.toString(), scale);
		second = libbcmath.bc_str2num(rightOperand.toString(), scale);
		return libbcmath.bc_compare(first, second);
	}

	function bcdiv(leftOperand, rightOperand, scale) {
		const libbcmath = _bc();
		if (typeof scale === 'undefined') {
			scale = libbcmath.scale;
		}
		scale = scale < 0 ? 0 : scale;
		const first = libbcmath.php_str2num(leftOperand.toString());
		const second = libbcmath.php_str2num(rightOperand.toString());
		const result = libbcmath.bc_divide(first, second, scale);
		if (result === -1) {
			throw new Error('(BC) Division by zero');
		}
		if (result.n_scale > scale) {
			result.n_scale = scale;
		}
		return result.toString();
	}

	function bcmul(leftOperand, rightOperand, scale) {
		const libbcmath = _bc();
		let first;
		let second;
		let result;
		if (typeof scale === 'undefined') {
			scale = libbcmath.scale;
		}
		scale = scale < 0 ? 0 : scale;
		first = libbcmath.bc_init_num();
		second = libbcmath.bc_init_num();
		result = libbcmath.bc_init_num();
		first = libbcmath.php_str2num(leftOperand.toString());
		second = libbcmath.php_str2num(rightOperand.toString());
		result = libbcmath.bc_multiply(first, second, scale);
		if (result.n_scale > scale) {
			result.n_scale = scale;
		}
		return result.toString();
	}

	function bcround(val, precision) {
		const libbcmath = _bc();
		let temp;
		let result;
		let digit;
		let rightOperand;
		temp = libbcmath.bc_init_num();
		temp = libbcmath.php_str2num(val.toString());
		if (precision >= temp.n_scale) {
			while (temp.n_scale < precision) {
				temp.n_value[temp.n_len + temp.n_scale] = 0;
				temp.n_scale++;
			}
			return temp.toString();
		}
		digit = temp.n_value[temp.n_len + precision] ?? 0;
		rightOperand = libbcmath.bc_init_num();
		rightOperand = libbcmath.bc_new_num(1, precision);
		if (digit >= 5) {
			rightOperand.n_value[rightOperand.n_len + rightOperand.n_scale - 1] = 1;
			if (temp.n_sign === libbcmath.MINUS) {
				rightOperand.n_sign = libbcmath.MINUS;
			}
			result = libbcmath.bc_add(temp, rightOperand, precision);
		} else {
			result = temp;
		}
		if (result.n_scale > precision) {
			result.n_scale = precision;
		}
		return result.toString();
	}

	function bcscale(scale) {
		const libbcmath = _bc();
		const oldScale = libbcmath.scale;
		if (scale == null) {
			return oldScale;
		}
		const parsedScale = Number.parseInt(String(scale), 10);
		if (Number.isNaN(parsedScale)) {
			return false;
		}
		if (parsedScale < 0) {
			return false;
		}
		libbcmath.scale = parsedScale;
		return oldScale;
	}

	function bcsub(leftOperand, rightOperand, scale) {
		const libbcmath = _bc();
		let first;
		let second;
		let result;
		if (typeof scale === 'undefined') {
			scale = libbcmath.scale;
		}
		scale = scale < 0 ? 0 : scale;
		first = libbcmath.bc_init_num();
		second = libbcmath.bc_init_num();
		result = libbcmath.bc_init_num();
		first = libbcmath.php_str2num(leftOperand.toString());
		second = libbcmath.php_str2num(rightOperand.toString());
		result = libbcmath.bc_sub(first, second, scale);
		if (result.n_scale > scale) {
			result.n_scale = scale;
		}
		return result.toString();
	}

	function ctype_alnum(text) {
		if (typeof text !== 'string') {
			return false;
		}
		setlocale('LC_ALL', 0);
		const pattern = getCtypePattern('an');
		return pattern instanceof RegExp ? pattern.test(text) : false;
	}

	function ctype_alpha(text) {
		if (typeof text !== 'string') {
			return false;
		}
		setlocale('LC_ALL', 0);
		const pattern = getCtypePattern('al');
		return pattern instanceof RegExp ? pattern.test(text) : false;
	}

	function ctype_cntrl(text) {
		if (typeof text !== 'string') {
			return false;
		}
		setlocale('LC_ALL', 0);
		const pattern = getCtypePattern('ct');
		return pattern instanceof RegExp ? pattern.test(text) : false;
	}

	function ctype_digit(text) {
		if (typeof text !== 'string') {
			return false;
		}
		setlocale('LC_ALL', 0);
		const pattern = getCtypePattern('dg');
		return pattern instanceof RegExp ? pattern.test(text) : false;
	}

	function ctype_graph(text) {
		if (typeof text !== 'string') {
			return false;
		}
		setlocale('LC_ALL', 0);
		const pattern = getCtypePattern('gr');
		return pattern instanceof RegExp ? pattern.test(text) : false;
	}

	function ctype_lower(text) {
		if (typeof text !== 'string') {
			return false;
		}
		setlocale('LC_ALL', 0);
		const pattern = getCtypePattern('lw');
		return pattern instanceof RegExp ? pattern.test(text) : false;
	}

	function ctype_print(text) {
		if (typeof text !== 'string') {
			return false;
		}
		setlocale('LC_ALL', 0);
		const pattern = getCtypePattern('pr');
		return pattern instanceof RegExp ? pattern.test(text) : false;
	}

	function ctype_punct(text) {
		if (typeof text !== 'string') {
			return false;
		}
		setlocale('LC_ALL', 0);
		const pattern = getCtypePattern('pu');
		return pattern instanceof RegExp ? pattern.test(text) : false;
	}

	function ctype_space(text) {
		if (typeof text !== 'string') {
			return false;
		}
		setlocale('LC_ALL', 0);
		const pattern = getCtypePattern('sp');
		return pattern instanceof RegExp ? pattern.test(text) : false;
	}

	function ctype_upper(text) {
		if (typeof text !== 'string') {
			return false;
		}
		setlocale('LC_ALL', 0);
		const pattern = getCtypePattern('up');
		return pattern instanceof RegExp ? pattern.test(text) : false;
	}

	function ctype_xdigit(text) {
		if (typeof text !== 'string') {
			return false;
		}
		setlocale('LC_ALL', 0);
		const pattern = getCtypePattern('xd');
		return pattern instanceof RegExp ? pattern.test(text) : false;
	}

	function checkdate(m, d, y) {
		return m > 0 && m < 13 && y > 0 && y < 32768 && d > 0 && d <= new Date(y, m, 0).getDate();
	}

	function date(format, timestamp) {
		let jsdate = new Date;
		let f;
		const txtWords = ['Sun', 'Mon', 'Tues', 'Wednes', 'Thurs', 'Fri', 'Satur', 'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
		const formatChr = /\\?(.?)/gi;
		const hasFormatterToken = token => Object.hasOwn(f, token);
		const formatChrCb = function(t, s) {
			return hasFormatterToken(t) ? String(f[t]()) : s;
		};
		const _pad = function(n, c) {
			let str = String(n);
			while (str.length < c) {
				str = '0' + str;
			}
			return str;
		};
		f = {
			'd': function() {
				return _pad(f.j(), 2);
			},
			'D': function() {
				return String(f.l()).slice(0, 3);
			},
			'j': function() {
				return jsdate.getDate();
			},
			'l': function() {
				return (txtWords[Number(f.w())] ?? '') + 'day';
			},
			'N': function() {
				return Number(f.w()) || 7;
			},
			'S': function() {
				const j = Number(f.j());
				let i = j % 10;
				if (i <= 3 && Number.parseInt(String(j % 100 / 10), 10) === 1) {
					i = 0;
				}
				return ['st', 'nd', 'rd'][i - 1] || 'th';
			},
			'w': function() {
				return jsdate.getDay();
			},
			'z': function() {
				const a = new Date(Number(f.Y()), Number(f.n()) - 1, Number(f.j()));
				const b = new Date(Number(f.Y()), 0, 1);
				return Math.round((a.getTime() - b.getTime()) / 864e5);
			},
			'W': function() {
				const a = new Date(Number(f.Y()), Number(f.n()) - 1, Number(f.j()) - Number(f.N()) + 3);
				const b = new Date(a.getFullYear(), 0, 4);
				return _pad(1 + Math.round((a.getTime() - b.getTime()) / 864e5 / 7), 2);
			},
			'F': function() {
				return txtWords[6 + Number(f.n())] ?? '';
			},
			'm': function() {
				return _pad(f.n(), 2);
			},
			'M': function() {
				return String(f.F()).slice(0, 3);
			},
			'n': function() {
				return jsdate.getMonth() + 1;
			},
			't': function() {
				return new Date(Number(f.Y()), Number(f.n()), 0).getDate();
			},
			'L': function() {
				const j = Number(f.Y());
				return j % 4 === 0 && j % 100 !== 0 || j % 400 === 0 ? 1 : 0;
			},
			'o': function() {
				const n = Number(f.n());
				const W = Number(f.W());
				const Y = Number(f.Y());
				return Y + (n === 12 && W < 9 ? 1 : n === 1 && W > 9 ? -1 : 0);
			},
			'Y': function() {
				return jsdate.getFullYear();
			},
			'y': function() {
				return String(f.Y()).slice(-2);
			},
			'a': function() {
				return jsdate.getHours() > 11 ? 'pm' : 'am';
			},
			'A': function() {
				return String(f.a()).toUpperCase();
			},
			'B': function() {
				const H = jsdate.getUTCHours() * 36e2;
				const i = jsdate.getUTCMinutes() * 60;
				const s = jsdate.getUTCSeconds();
				return _pad(Math.floor((H + i + s + 36e2) / 86.4) % 1e3, 3);
			},
			'g': function() {
				return Number(f.G()) % 12 || 12;
			},
			'G': function() {
				return jsdate.getHours();
			},
			'h': function() {
				return _pad(f.g(), 2);
			},
			'H': function() {
				return _pad(f.G(), 2);
			},
			'i': function() {
				return _pad(jsdate.getMinutes(), 2);
			},
			's': function() {
				return _pad(jsdate.getSeconds(), 2);
			},
			'u': function() {
				return _pad(jsdate.getMilliseconds() * 1000, 6);
			},
			'e': function() {
				const msg = 'Not supported (see source code of date() for timezone on how to add support)';
				throw new Error(msg);
			},
			'I': function() {
				const a = new Date(Number(f.Y()), 0);
				const c = Date.UTC(Number(f.Y()), 0);
				const b = new Date(Number(f.Y()), 6);
				const d = Date.UTC(Number(f.Y()), 6);
				return a.getTime() - c !== b.getTime() - d ? 1 : 0;
			},
			'O': function() {
				const tzo = jsdate.getTimezoneOffset();
				const a = Math.abs(tzo);
				return (tzo > 0 ? '-' : '+') + _pad(Math.floor(a / 60) * 100 + a % 60, 4);
			},
			'P': function() {
				const O = String(f.O());
				return O.slice(0, 3) + ':' + O.slice(3, 5);
			},
			'T': function() {
				return 'UTC';
			},
			'Z': function() {
				return -jsdate.getTimezoneOffset() * 60;
			},
			'c': function() {
				return 'Y-m-d\\TH:i:sP'.replace(formatChr, formatChrCb);
			},
			'r': function() {
				return 'D, d M Y H:i:s O'.replace(formatChr, formatChrCb);
			},
			'U': function() {
				return jsdate.getTime() / 1000 | 0;
			}
		};
		const _date = function(formatStr, timestampValue) {
			jsdate = timestampValue === undefined ? new Date : timestampValue instanceof Date ? new Date(timestampValue) : new Date(Number(timestampValue) * 1000);
			return formatStr.replace(formatChr, formatChrCb);
		};
		return _date(format, timestamp);
	}

	function date_parse(date) {
		let ts;
		try {
			ts = strtotime(date, undefined);
		} catch (_e) {
			ts = false;
		}
		if (!ts) {
			return false;
		}
		const dt = new Date(ts * 1000);
		const retObj = {
			'year': dt.getFullYear(),
			'month': dt.getMonth() + 1,
			'day': dt.getDate(),
			'hour': dt.getHours(),
			'minute': dt.getMinutes(),
			'second': dt.getSeconds(),
			'fraction': Number.parseFloat(`0.${dt.getMilliseconds()}`),
			'is_localtime': dt.getTimezoneOffset() !== 0
		};
		return retObj;
	}

	function getdate(timestamp) {
		const _w = ['Sun', 'Mon', 'Tues', 'Wednes', 'Thurs', 'Fri', 'Satur'];
		const _m = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
		const d = typeof timestamp === 'undefined' ? new Date : timestamp instanceof Date ? new Date(timestamp) : new Date(Number(timestamp) * 1000);
		const w = d.getDay();
		const m = d.getMonth();
		const y = d.getFullYear();
		const r = {
			'seconds': d.getSeconds(),
			'minutes': d.getMinutes(),
			'hours': d.getHours(),
			'mday': d.getDate(),
			'wday': w,
			'mon': m + 1,
			'year': y,
			'yday': Math.floor((d.getTime() - new Date(y, 0, 1).getTime()) / 86400000),
			'weekday': (_w[w] ?? '') + 'day',
			'month': _m[m] ?? '',
			'0': Number.parseInt(String(d.getTime() / 1000), 10)
		};
		return r;
	}

	function gettimeofday(returnFloat) {
		const t = new Date;
		if (returnFloat) {
			return t.getTime() / 1000;
		}
		const y = t.getFullYear();
		return {
			'sec': t.getUTCSeconds(),
			'usec': t.getUTCMilliseconds() * 1000,
			'minuteswest': t.getTimezoneOffset(),
			'dsttime': Number(new Date(y, 0).getTime() - Date.UTC(y, 0) !== new Date(y, 6).getTime() - Date.UTC(y, 6))
		};
	}

	function gmdate(format, timestamp) {
		const dt = typeof timestamp === 'undefined' ? new Date : timestamp instanceof Date ? new Date(timestamp) : new Date(Number(timestamp) * 1000);
		const ts = Date.parse(dt.toUTCString().slice(0, -4)) / 1000;
		return date(format, ts);
	}

	function gmmktime(hour, minute, second, month, day, year) {
		const d = new Date;
		const resolved = [d.getUTCHours(), d.getUTCMinutes(), d.getUTCSeconds(), d.getUTCMonth() + 1, d.getUTCDate(), d.getUTCFullYear()];
		const input = [hour, minute, second, month, day, year];
		for (let i = 0; i < input.length; i++) {
			const value = input[i];
			if (typeof value !== 'undefined') {
				const parsed = Number.parseInt(String(value), 10);
				if (Number.isNaN(parsed)) {
					return false;
				}
				resolved[i] = parsed;
			}
		}
		const normalizedYear = resolved[5] + (resolved[5] >= 0 ? resolved[5] <= 69 ? 2000 : resolved[5] <= 100 ? 1900 : 0 : 0);
		d.setUTCFullYear(normalizedYear, resolved[3] - 1, resolved[4]);
		d.setUTCHours(resolved[0], resolved[1], resolved[2]);
		const time = d.getTime();
		return (time / 1e3 >> 0) - Number(time < 0);
	}

	function idate(format, timestamp) {
		if (!arguments.length) {
			throw new Error('idate() expects at least 1 parameter, 0 given');
		}
		if (!format.length || format.length > 1) {
			throw new Error('idate format is one char');
		}
		const _date = typeof timestamp === 'undefined' ? new Date : timestamp instanceof Date ? new Date(timestamp.getTime()) : new Date(Number(timestamp) * 1000);
		let a;
		switch (format) {
			case 'B':
				return Math.floor((_date.getUTCHours() * 36e2 + _date.getUTCMinutes() * 60 + _date.getUTCSeconds() + 36e2) / 86.4) % 1e3;
			case 'd':
				return _date.getDate();
			case 'h':
				return _date.getHours() % 12 || 12;
			case 'H':
				return _date.getHours();
			case 'i':
				return _date.getMinutes();
			case 'I':
				a = _date.getFullYear();
				return Number(new Date(a, 0).getTime() - Date.UTC(a, 0) !== new Date(a, 6).getTime() - Date.UTC(a, 6));
			case 'L':
				a = _date.getFullYear();
				return !(a & 3) && (a % 1e2 || !(a % 4e2)) ? 1 : 0;
			case 'm':
				return _date.getMonth() + 1;
			case 's':
				return _date.getSeconds();
			case 't':
				return new Date(_date.getFullYear(), _date.getMonth() + 1, 0).getDate();
			case 'U':
				return Math.round(_date.getTime() / 1000);
			case 'w':
				return _date.getDay();
			case 'W': {
				const weekDate = new Date(_date.getFullYear(), _date.getMonth(), _date.getDate() - (_date.getDay() || 7) + 3);
				return 1 + Math.round((weekDate.getTime() - new Date(weekDate.getFullYear(), 0, 4).getTime()) / 864e5 / 7);
			}
			case 'y':
				return parseInt((_date.getFullYear() + '').slice(2), 10);
			case 'Y':
				return _date.getFullYear();
			case 'z':
				return Math.floor((_date.getTime() - new Date(_date.getFullYear(), 0, 1).getTime()) / 864e5);
			case 'Z':
				return -_date.getTimezoneOffset() * 60;
			default:
				throw new Error('Unrecognized _date format token');
		}
	}

	function microtime(getAsFloat) {
		let s = 0;
		let now = 0;
		if (typeof performance !== 'undefined' && performance.now && performance.timing) {
			now = (performance.now() + performance.timing.navigationStart) / 1e3;
			if (getAsFloat) {
				return now;
			}
			s = now | 0;
			return Math.round((now - s) * 1e6) / 1e6 + ' ' + s;
		} else {
			now = (Date.now ? Date.now() : (new Date).getTime()) / 1e3;
			if (getAsFloat) {
				return now;
			}
			s = now | 0;
			return Math.round((now - s) * 1e3) / 1e3 + ' ' + s;
		}
	}

	function mktime(hour, minute, second, month, day, year) {
		const d = new Date;
		const resolved = [d.getHours(), d.getMinutes(), d.getSeconds(), d.getMonth() + 1, d.getDate(), d.getFullYear()];
		const input = [hour, minute, second, month, day, year];
		for (let i = 0; i < input.length; i++) {
			const value = input[i];
			if (typeof value !== 'undefined') {
				const parsed = Number.parseInt(String(value), 10);
				if (Number.isNaN(parsed)) {
					return false;
				}
				resolved[i] = parsed;
			}
		}
		const normalizedYear = resolved[5] + (resolved[5] >= 0 ? resolved[5] <= 69 ? 2e3 : resolved[5] <= 100 ? 1900 : 0 : 0);
		d.setFullYear(normalizedYear, resolved[3] - 1, resolved[4]);
		d.setHours(resolved[0], resolved[1], resolved[2]);
		const time = d.getTime();
		return (time / 1e3 >> 0) - Number(time < 0);
	}
	const reSpace = '[ \\t]+';
	const reSpaceOpt = '[ \\t]*';
	const reMeridian = '(?:([ap])\\.?m\\.?([\\t ]|$))';
	const reHour24 = '(2[0-4]|[01]?[0-9])';
	const reHour24lz = '([01][0-9]|2[0-4])';
	const reHour12 = '(0?[1-9]|1[0-2])';
	const reMinute = '([0-5]?[0-9])';
	const reMinutelz = '([0-5][0-9])';
	const reSecond = '(60|[0-5]?[0-9])';
	const reSecondlz = '(60|[0-5][0-9])';
	const reFrac = '(?:\\.([0-9]+))';
	const reDayfull = 'sunday|monday|tuesday|wednesday|thursday|friday|saturday';
	const reDayabbr = 'sun|mon|tue|wed|thu|fri|sat';
	const reDaytext = reDayfull + '|' + reDayabbr + '|weekdays?';
	const reReltextnumber = 'first|second|third|fourth|fifth|sixth|seventh|eighth?|ninth|tenth|eleventh|twelfth';
	const reReltexttext = 'next|last|previous|this';
	const reReltextunit = '(?:second|sec|minute|min|hour|day|fortnight|forthnight|month|year)s?|weeks|' + reDaytext;
	const reYear = '([0-9]{1,4})';
	const reYear2 = '([0-9]{2})';
	const reYear4 = '([0-9]{4})';
	const reYear4withSign = '([+-]?[0-9]{4})';
	const reMonth = '(1[0-2]|0?[0-9])';
	const reMonthlz = '(0[0-9]|1[0-2])';
	const reDay = '(?:(3[01]|[0-2]?[0-9])(?:st|nd|rd|th)?)';
	const reDaylz = '(0[0-9]|[1-2][0-9]|3[01])';
	const reMonthFull = 'january|february|march|april|may|june|july|august|september|october|november|december';
	const reMonthAbbr = 'jan|feb|mar|apr|may|jun|jul|aug|sept?|oct|nov|dec';
	const reMonthroman = 'i[vx]|vi{0,3}|xi{0,2}|i{1,3}';
	const reMonthText = '(' + reMonthFull + '|' + reMonthAbbr + '|' + reMonthroman + ')';
	const reTzCorrection = '((?:GMT)?([+-])' + reHour24 + ':?' + reMinute + '?)';
	const reTzAbbr = '\\(?([a-zA-Z]{1,6})\\)?';
	const reDayOfYear = '(00[1-9]|0[1-9][0-9]|[12][0-9][0-9]|3[0-5][0-9]|36[0-6])';
	const reWeekOfYear = '(0[1-9]|[1-4][0-9]|5[0-3])';
	const reDateNoYear = reMonthText + '[ .\\t-]*' + reDay + '[,.stndrh\\t ]*';

	function processMeridian(hour, meridian) {
		const normalizedMeridian = meridian?.toLowerCase();
		switch (normalizedMeridian) {
			case 'a':
				hour += hour === 12 ? -12 : 0;
				break;
			case 'p':
				hour += hour !== 12 ? 12 : 0;
				break;
		}
		return hour;
	}

	function processYear(yearStr) {
		let year = +yearStr;
		if (yearStr.length < 4 && year < 100) {
			year += year < 70 ? 2000 : 1900;
		}
		return year;
	}

	function lookupMonth(monthStr) {
		const monthLookup = {
			'jan': 0,
			'january': 0,
			'i': 0,
			'feb': 1,
			'february': 1,
			'ii': 1,
			'mar': 2,
			'march': 2,
			'iii': 2,
			'apr': 3,
			'april': 3,
			'iv': 3,
			'may': 4,
			'v': 4,
			'jun': 5,
			'june': 5,
			'vi': 5,
			'jul': 6,
			'july': 6,
			'vii': 6,
			'aug': 7,
			'august': 7,
			'viii': 7,
			'sep': 8,
			'sept': 8,
			'september': 8,
			'ix': 8,
			'oct': 9,
			'october': 9,
			'x': 9,
			'nov': 10,
			'november': 10,
			'xi': 10,
			'dec': 11,
			'december': 11,
			'xii': 11
		};
		return monthLookup[monthStr.toLowerCase()] ?? Number.NaN;
	}

	function lookupWeekday(dayStr, desiredSundayNumber = 0) {
		const dayNumbers = {
			'mon': 1,
			'monday': 1,
			'tue': 2,
			'tuesday': 2,
			'wed': 3,
			'wednesday': 3,
			'thu': 4,
			'thursday': 4,
			'fri': 5,
			'friday': 5,
			'sat': 6,
			'saturday': 6,
			'sun': 0,
			'sunday': 0
		};
		return dayNumbers[dayStr.toLowerCase()] || desiredSundayNumber;
	}

	function lookupRelative(relText) {
		const relativeNumbers = {
			'last': -1,
			'previous': -1,
			'this': 0,
			'first': 1,
			'next': 1,
			'second': 2,
			'third': 3,
			'fourth': 4,
			'fifth': 5,
			'sixth': 6,
			'seventh': 7,
			'eight': 8,
			'eighth': 8,
			'ninth': 9,
			'tenth': 10,
			'eleventh': 11,
			'twelfth': 12
		};
		const relativeBehavior = {
			'this': 1
		};
		const relTextLower = relText.toLowerCase();
		return {
			'amount': relativeNumbers[relTextLower] ?? 0,
			'behavior': relativeBehavior[relTextLower] || 0
		};
	}

	function processTzCorrection(tzOffset, oldValue = Number.NaN) {
		const reTzCorrectionLoose = /(?:GMT)?([+-])(\d+)(:?)(\d{0,2})/i;
		const tzMatch = tzOffset?.match(reTzCorrectionLoose);
		if (!tzMatch) {
			return oldValue;
		}
		const sign = tzMatch[1] === '-' ? -1 : 1;
		let hours = +(tzMatch[2] ?? 0);
		let minutes = +(tzMatch[4] ?? 0);
		if (!tzMatch[4] && !tzMatch[3]) {
			minutes = Math.floor(hours % 100);
			hours = Math.floor(hours / 100);
		}
		return sign * (hours * 60 + minutes) * 60;
	}
	const tzAbbrOffsets = {
		'acdt': 37800,
		'acst': 34200,
		'addt': -7200,
		'adt': -10800,
		'aedt': 39600,
		'aest': 36000,
		'ahdt': -32400,
		'ahst': -36000,
		'akdt': -28800,
		'akst': -32400,
		'amt': -13840,
		'apt': -10800,
		'ast': -14400,
		'awdt': 32400,
		'awst': 28800,
		'awt': -10800,
		'bdst': 7200,
		'bdt': -36000,
		'bmt': -14309,
		'bst': 3600,
		'cast': 34200,
		'cat': 7200,
		'cddt': -14400,
		'cdt': -18000,
		'cemt': 10800,
		'cest': 7200,
		'cet': 3600,
		'cmt': -15408,
		'cpt': -18000,
		'cst': -21600,
		'cwt': -18000,
		'chst': 36000,
		'dmt': -1521,
		'eat': 10800,
		'eddt': -10800,
		'edt': -14400,
		'eest': 10800,
		'eet': 7200,
		'emt': -26248,
		'ept': -14400,
		'est': -18000,
		'ewt': -14400,
		'ffmt': -14660,
		'fmt': -4056,
		'gdt': 39600,
		'gmt': 0,
		'gst': 36000,
		'hdt': -34200,
		'hkst': 32400,
		'hkt': 28800,
		'hmt': -19776,
		'hpt': -34200,
		'hst': -36000,
		'hwt': -34200,
		'iddt': 14400,
		'idt': 10800,
		'imt': 25025,
		'ist': 7200,
		'jdt': 36000,
		'jmt': 8440,
		'jst': 32400,
		'kdt': 36000,
		'kmt': 5736,
		'kst': 30600,
		'lst': 9394,
		'mddt': -18000,
		'mdst': 16279,
		'mdt': -21600,
		'mest': 7200,
		'met': 3600,
		'mmt': 9017,
		'mpt': -21600,
		'msd': 14400,
		'msk': 10800,
		'mst': -25200,
		'mwt': -21600,
		'nddt': -5400,
		'ndt': -9052,
		'npt': -9000,
		'nst': -12600,
		'nwt': -9000,
		'nzdt': 46800,
		'nzmt': 41400,
		'nzst': 43200,
		'pddt': -21600,
		'pdt': -25200,
		'pkst': 21600,
		'pkt': 18000,
		'plmt': 25590,
		'pmt': -13236,
		'ppmt': -17340,
		'ppt': -25200,
		'pst': -28800,
		'pwt': -25200,
		'qmt': -18840,
		'rmt': 5794,
		'sast': 7200,
		'sdmt': -16800,
		'sjmt': -20173,
		'smt': -13884,
		'sst': -39600,
		'tbmt': 10751,
		'tmt': 12344,
		'uct': 0,
		'utc': 0,
		'wast': 7200,
		'wat': 3600,
		'wemt': 7200,
		'west': 3600,
		'wet': 0,
		'wib': 25200,
		'wita': 28800,
		'wit': 32400,
		'wmt': 5040,
		'yddt': -25200,
		'ydt': -28800,
		'ypt': -28800,
		'yst': -32400,
		'ywt': -28800,
		'a': 3600,
		'b': 7200,
		'c': 10800,
		'd': 14400,
		'e': 18000,
		'f': 21600,
		'g': 25200,
		'h': 28800,
		'i': 32400,
		'k': 36000,
		'l': 39600,
		'm': 43200,
		'n': -3600,
		'o': -7200,
		'p': -10800,
		'q': -14400,
		'r': -18000,
		's': -21600,
		't': -25200,
		'u': -28800,
		'v': -32400,
		'w': -36000,
		'x': -39600,
		'y': -43200,
		'z': 0
	};
	const formats = {
		'yesterday': {
			'regex': /^yesterday/i,
			'name': 'yesterday',
			'callback'() {
				this.rd -= 1;
				return this.resetTime();
			}
		},
		'now': {
			'regex': /^now/i,
			'name': 'now'
		},
		'noon': {
			'regex': /^noon/i,
			'name': 'noon',
			'callback'() {
				return this.resetTime() && this.time(12, 0, 0, 0);
			}
		},
		'midnightOrToday': {
			'regex': /^(midnight|today)/i,
			'name': 'midnight | today',
			'callback'() {
				return this.resetTime();
			}
		},
		'tomorrow': {
			'regex': /^tomorrow/i,
			'name': 'tomorrow',
			'callback'() {
				this.rd += 1;
				return this.resetTime();
			}
		},
		'timestamp': {
			'regex': /^@(-?\d+)/i,
			'name': 'timestamp',
			'callback'(match, timestamp) {
				this.rs += +timestamp;
				this.y = 1970;
				this.m = 0;
				this.d = 1;
				this.dates = 0;
				return this.resetTime() && this.zone(0);
			}
		},
		'firstOrLastDay': {
			'regex': /^(first|last) day of/i,
			'name': 'firstdayof | lastdayof',
			'callback'(match, day) {
				if (day.toLowerCase() === 'first') {
					this.firstOrLastDayOfMonth = 1;
				} else {
					this.firstOrLastDayOfMonth = -1;
				}
			}
		},
		'backOrFrontOf': {
			'regex': new RegExp('^(back|front) of ' + reHour24 + reSpaceOpt + reMeridian + '?', 'i'),
			'name': 'backof | frontof',
			'callback'(match, side, hours, meridian) {
				const back = side.toLowerCase() === 'back';
				let hour = +hours;
				let minute = 15;
				if (!back) {
					hour -= 1;
					minute = 45;
				}
				hour = processMeridian(hour, meridian);
				return this.resetTime() && this.time(hour, minute, 0, 0);
			}
		},
		'weekdayOf': {
			'regex': new RegExp('^(' + reReltextnumber + '|' + reReltexttext + ')' + reSpace + '(' + reDayfull + '|' + reDayabbr + ')' + reSpace + 'of', 'i'),
			'name': 'weekdayof'
		},
		'mssqltime': {
			'regex': new RegExp('^' + reHour12 + ':' + reMinutelz + ':' + reSecondlz + '[:.]([0-9]+)' + reMeridian, 'i'),
			'name': 'mssqltime',
			'callback'(match, hour, minute, second, frac, meridian) {
				return this.time(processMeridian(+hour, meridian), +minute, +second, +frac.substr(0, 3));
			}
		},
		'oracledate': {
			'regex': /^(\d{2})-([A-Z]{3})-(\d{2})$/i,
			'name': 'd-M-y',
			'callback'(match, day, monthText, year) {
				const monthByName = {
					'JAN': 0,
					'FEB': 1,
					'MAR': 2,
					'APR': 3,
					'MAY': 4,
					'JUN': 5,
					'JUL': 6,
					'AUG': 7,
					'SEP': 8,
					'OCT': 9,
					'NOV': 10,
					'DEC': 11
				};
				const month = monthByName[monthText.toUpperCase()] ?? Number.NaN;
				return this.ymd(2000 + parseInt(year, 10), month, parseInt(day, 10));
			}
		},
		'timeLong12': {
			'regex': new RegExp('^' + reHour12 + '[:.]' + reMinute + '[:.]' + reSecondlz + reSpaceOpt + reMeridian, 'i'),
			'name': 'timelong12',
			'callback'(match, hour, minute, second, meridian) {
				return this.time(processMeridian(+hour, meridian), +minute, +second, 0);
			}
		},
		'timeShort12': {
			'regex': new RegExp('^' + reHour12 + '[:.]' + reMinutelz + reSpaceOpt + reMeridian, 'i'),
			'name': 'timeshort12',
			'callback'(match, hour, minute, meridian) {
				return this.time(processMeridian(+hour, meridian), +minute, 0, 0);
			}
		},
		'timeTiny12': {
			'regex': new RegExp('^' + reHour12 + reSpaceOpt + reMeridian, 'i'),
			'name': 'timetiny12',
			'callback'(match, hour, meridian) {
				return this.time(processMeridian(+hour, meridian), 0, 0, 0);
			}
		},
		'soap': {
			'regex': new RegExp('^' + reYear4 + '-' + reMonthlz + '-' + reDaylz + 'T' + reHour24lz + ':' + reMinutelz + ':' + reSecondlz + reFrac + reTzCorrection + '?', 'i'),
			'name': 'soap',
			'callback'(match, year, month, day, hour, minute, second, frac, tzCorrection) {
				return this.ymd(+year, +month - 1, +day) && this.time(+hour, +minute, +second, +frac.substr(0, 3)) && this.zone(processTzCorrection(tzCorrection));
			}
		},
		'wddx': {
			'regex': new RegExp('^' + reYear4 + '-' + reMonth + '-' + reDay + 'T' + reHour24 + ':' + reMinute + ':' + reSecond),
			'name': 'wddx',
			'callback'(match, year, month, day, hour, minute, second) {
				return this.ymd(+year, +month - 1, +day) && this.time(+hour, +minute, +second, 0);
			}
		},
		'exif': {
			'regex': new RegExp('^' + reYear4 + ':' + reMonthlz + ':' + reDaylz + ' ' + reHour24lz + ':' + reMinutelz + ':' + reSecondlz, 'i'),
			'name': 'exif',
			'callback'(match, year, month, day, hour, minute, second) {
				return this.ymd(+year, +month - 1, +day) && this.time(+hour, +minute, +second, 0);
			}
		},
		'xmlRpc': {
			'regex': new RegExp('^' + reYear4 + reMonthlz + reDaylz + 'T' + reHour24 + ':' + reMinutelz + ':' + reSecondlz),
			'name': 'xmlrpc',
			'callback'(match, year, month, day, hour, minute, second) {
				return this.ymd(+year, +month - 1, +day) && this.time(+hour, +minute, +second, 0);
			}
		},
		'xmlRpcNoColon': {
			'regex': new RegExp('^' + reYear4 + reMonthlz + reDaylz + '[Tt]' + reHour24 + reMinutelz + reSecondlz),
			'name': 'xmlrpcnocolon',
			'callback'(match, year, month, day, hour, minute, second) {
				return this.ymd(+year, +month - 1, +day) && this.time(+hour, +minute, +second, 0);
			}
		},
		'clf': {
			'regex': new RegExp('^' + reDay + '/(' + reMonthAbbr + ')/' + reYear4 + ':' + reHour24lz + ':' + reMinutelz + ':' + reSecondlz + reSpace + reTzCorrection, 'i'),
			'name': 'clf',
			'callback'(match, day, month, year, hour, minute, second, tzCorrection) {
				return this.ymd(+year, lookupMonth(month), +day) && this.time(+hour, +minute, +second, 0) && this.zone(processTzCorrection(tzCorrection));
			}
		},
		'iso8601long': {
			'regex': new RegExp('^t?' + reHour24 + '[:.]' + reMinute + '[:.]' + reSecond + reFrac, 'i'),
			'name': 'iso8601long',
			'callback'(match, hour, minute, second, frac) {
				return this.time(+hour, +minute, +second, +frac.substr(0, 3));
			}
		},
		'dateTextual': {
			'regex': new RegExp('^' + reMonthText + '[ .\\t-]*' + reDay + '[,.stndrh\\t ]+' + reYear, 'i'),
			'name': 'datetextual',
			'callback'(match, month, day, year) {
				return this.ymd(processYear(year), lookupMonth(month), +day);
			}
		},
		'pointedDate4': {
			'regex': new RegExp('^' + reDay + '[.\\t-]' + reMonth + '[.-]' + reYear4),
			'name': 'pointeddate4',
			'callback'(match, day, month, year) {
				return this.ymd(+year, +month - 1, +day);
			}
		},
		'pointedDate2': {
			'regex': new RegExp('^' + reDay + '[.\\t]' + reMonth + '\\.' + reYear2),
			'name': 'pointeddate2',
			'callback'(match, day, month, year) {
				return this.ymd(processYear(year), +month - 1, +day);
			}
		},
		'timeLong24': {
			'regex': new RegExp('^t?' + reHour24 + '[:.]' + reMinute + '[:.]' + reSecond),
			'name': 'timelong24',
			'callback'(match, hour, minute, second) {
				return this.time(+hour, +minute, +second, 0);
			}
		},
		'dateNoColon': {
			'regex': new RegExp('^' + reYear4 + reMonthlz + reDaylz),
			'name': 'datenocolon',
			'callback'(match, year, month, day) {
				return this.ymd(+year, +month - 1, +day);
			}
		},
		'pgydotd': {
			'regex': new RegExp('^' + reYear4 + '\\.?' + reDayOfYear),
			'name': 'pgydotd',
			'callback'(match, year, day) {
				return this.ymd(+year, 0, +day);
			}
		},
		'timeShort24': {
			'regex': new RegExp('^t?' + reHour24 + '[:.]' + reMinute, 'i'),
			'name': 'timeshort24',
			'callback'(match, hour, minute) {
				return this.time(+hour, +minute, 0, 0);
			}
		},
		'iso8601noColon': {
			'regex': new RegExp('^t?' + reHour24lz + reMinutelz + reSecondlz, 'i'),
			'name': 'iso8601nocolon',
			'callback'(match, hour, minute, second) {
				return this.time(+hour, +minute, +second, 0);
			}
		},
		'iso8601dateSlash': {
			'regex': new RegExp('^' + reYear4 + '/' + reMonthlz + '/' + reDaylz + '/'),
			'name': 'iso8601dateslash',
			'callback'(match, year, month, day) {
				return this.ymd(+year, +month - 1, +day);
			}
		},
		'dateSlash': {
			'regex': new RegExp('^' + reYear4 + '/' + reMonth + '/' + reDay),
			'name': 'dateslash',
			'callback'(match, year, month, day) {
				return this.ymd(+year, +month - 1, +day);
			}
		},
		'american': {
			'regex': new RegExp('^' + reMonth + '/' + reDay + '/' + reYear),
			'name': 'american',
			'callback'(match, month, day, year) {
				return this.ymd(processYear(year), +month - 1, +day);
			}
		},
		'americanShort': {
			'regex': new RegExp('^' + reMonth + '/' + reDay),
			'name': 'americanshort',
			'callback'(match, month, day) {
				return this.ymd(this.y, +month - 1, +day);
			}
		},
		'gnuDateShortOrIso8601date2': {
			'regex': new RegExp('^' + reYear + '-' + reMonth + '-' + reDay),
			'name': 'gnudateshort | iso8601date2',
			'callback'(match, year, month, day) {
				return this.ymd(processYear(year), +month - 1, +day);
			}
		},
		'iso8601date4': {
			'regex': new RegExp('^' + reYear4withSign + '-' + reMonthlz + '-' + reDaylz),
			'name': 'iso8601date4',
			'callback'(match, year, month, day) {
				return this.ymd(+year, +month - 1, +day);
			}
		},
		'gnuNoColon': {
			'regex': new RegExp('^t?' + reHour24lz + reMinutelz, 'i'),
			'name': 'gnunocolon',
			'callback'(match, hour, minute) {
				switch (this.times) {
					case 0:
						return this.time(+hour, +minute, 0, this.f);
					case 1:
						this.y = +hour * 100 + +minute;
						this.times++;
						return true;
					default:
						return false;
				}
			}
		},
		'gnuDateShorter': {
			'regex': new RegExp('^' + reYear4 + '-' + reMonth),
			'name': 'gnudateshorter',
			'callback'(match, year, month) {
				return this.ymd(+year, +month - 1, 1);
			}
		},
		'pgTextReverse': {
			'regex': new RegExp('^' + '(\\d{3,4}|[4-9]\\d|3[2-9])-(' + reMonthAbbr + ')-' + reDaylz, 'i'),
			'name': 'pgtextreverse',
			'callback'(match, year, month, day) {
				return this.ymd(processYear(year), lookupMonth(month), +day);
			}
		},
		'dateFull': {
			'regex': new RegExp('^' + reDay + '[ \\t.-]*' + reMonthText + '[ \\t.-]*' + reYear, 'i'),
			'name': 'datefull',
			'callback'(match, day, month, year) {
				return this.ymd(processYear(year), lookupMonth(month), +day);
			}
		},
		'dateNoDay': {
			'regex': new RegExp('^' + reMonthText + '[ .\\t-]*' + reYear4, 'i'),
			'name': 'datenoday',
			'callback'(match, month, year) {
				return this.ymd(+year, lookupMonth(month), 1);
			}
		},
		'dateNoDayRev': {
			'regex': new RegExp('^' + reYear4 + '[ .\\t-]*' + reMonthText, 'i'),
			'name': 'datenodayrev',
			'callback'(match, year, month) {
				return this.ymd(+year, lookupMonth(month), 1);
			}
		},
		'pgTextShort': {
			'regex': new RegExp('^(' + reMonthAbbr + ')-' + reDaylz + '-' + reYear, 'i'),
			'name': 'pgtextshort',
			'callback'(match, month, day, year) {
				return this.ymd(processYear(year), lookupMonth(month), +day);
			}
		},
		'dateNoYear': {
			'regex': new RegExp('^' + reDateNoYear, 'i'),
			'name': 'datenoyear',
			'callback'(match, month, day) {
				return this.ymd(this.y, lookupMonth(month), +day);
			}
		},
		'dateNoYearRev': {
			'regex': new RegExp('^' + reDay + '[ .\\t-]*' + reMonthText, 'i'),
			'name': 'datenoyearrev',
			'callback'(match, day, month) {
				return this.ymd(this.y, lookupMonth(month), +day);
			}
		},
		'isoWeekDay': {
			'regex': new RegExp('^' + reYear4 + '-?W' + reWeekOfYear + '(?:-?([0-7]))?'),
			'name': 'isoweekday | isoweek',
			'callback'(match, year, week, day) {
				const dayOfWeek = day ? +day : 1;
				if (!this.ymd(+year, 0, 1)) {
					return false;
				}
				let jan1DayOfWeek = new Date(this.y, this.m, this.d).getDay();
				jan1DayOfWeek = 0 - (jan1DayOfWeek > 4 ? jan1DayOfWeek - 7 : jan1DayOfWeek);
				this.rd += jan1DayOfWeek + (+week - 1) * 7 + dayOfWeek;
				return true;
			}
		},
		'relativeText': {
			'regex': new RegExp('^(' + reReltextnumber + '|' + reReltexttext + ')' + reSpace + '(' + reReltextunit + ')', 'i'),
			'name': 'relativetext',
			'callback'(match, relValue, relUnit) {
				const {
					'amount': amount,
					'behavior': behavior
				} = lookupRelative(relValue);
				switch (relUnit.toLowerCase()) {
					case 'sec':
					case 'secs':
					case 'second':
					case 'seconds':
						this.rs += amount;
						break;
					case 'min':
					case 'mins':
					case 'minute':
					case 'minutes':
						this.ri += amount;
						break;
					case 'hour':
					case 'hours':
						this.rh += amount;
						break;
					case 'day':
					case 'days':
						this.rd += amount;
						break;
					case 'fortnight':
					case 'fortnights':
					case 'forthnight':
					case 'forthnights':
						this.rd += amount * 14;
						break;
					case 'week':
					case 'weeks':
						this.rd += amount * 7;
						break;
					case 'month':
					case 'months':
						this.rm += amount;
						break;
					case 'year':
					case 'years':
						this.ry += amount;
						break;
					case 'mon':
					case 'monday':
					case 'tue':
					case 'tuesday':
					case 'wed':
					case 'wednesday':
					case 'thu':
					case 'thursday':
					case 'fri':
					case 'friday':
					case 'sat':
					case 'saturday':
					case 'sun':
					case 'sunday':
						this.resetTime();
						this.weekday = lookupWeekday(relUnit, 7);
						this.weekdayBehavior = 1;
						this.rd += (amount > 0 ? amount - 1 : amount) * 7;
						break;
					case 'weekday':
					case 'weekdays':
						break;
				}
			}
		},
		'relative': {
			'regex': new RegExp('^([+-]*)[ \\t]*(\\d+)' + reSpaceOpt + '(' + reReltextunit + '|week)', 'i'),
			'name': 'relative',
			'callback'(match, signs, relValue, relUnit) {
				const minuses = signs.replace(/[^-]/g, '').length;
				const amount = +relValue * Math.pow(-1, minuses);
				switch (relUnit.toLowerCase()) {
					case 'sec':
					case 'secs':
					case 'second':
					case 'seconds':
						this.rs += amount;
						break;
					case 'min':
					case 'mins':
					case 'minute':
					case 'minutes':
						this.ri += amount;
						break;
					case 'hour':
					case 'hours':
						this.rh += amount;
						break;
					case 'day':
					case 'days':
						this.rd += amount;
						break;
					case 'fortnight':
					case 'fortnights':
					case 'forthnight':
					case 'forthnights':
						this.rd += amount * 14;
						break;
					case 'week':
					case 'weeks':
						this.rd += amount * 7;
						break;
					case 'month':
					case 'months':
						this.rm += amount;
						break;
					case 'year':
					case 'years':
						this.ry += amount;
						break;
					case 'mon':
					case 'monday':
					case 'tue':
					case 'tuesday':
					case 'wed':
					case 'wednesday':
					case 'thu':
					case 'thursday':
					case 'fri':
					case 'friday':
					case 'sat':
					case 'saturday':
					case 'sun':
					case 'sunday':
						this.resetTime();
						this.weekday = lookupWeekday(relUnit, 7);
						this.weekdayBehavior = 1;
						this.rd += (amount > 0 ? amount - 1 : amount) * 7;
						break;
					case 'weekday':
					case 'weekdays':
						break;
				}
			}
		},
		'dayText': {
			'regex': new RegExp('^(' + reDaytext + ')', 'i'),
			'name': 'daytext',
			'callback'(match, dayText) {
				this.resetTime();
				this.weekday = lookupWeekday(dayText, 0);
				if (this.weekdayBehavior !== 2) {
					this.weekdayBehavior = 1;
				}
			}
		},
		'relativeTextWeek': {
			'regex': new RegExp('^(' + reReltexttext + ')' + reSpace + 'week', 'i'),
			'name': 'relativetextweek',
			'callback'(match, relText) {
				this.weekdayBehavior = 2;
				switch (relText.toLowerCase()) {
					case 'this':
						this.rd += 0;
						break;
					case 'next':
						this.rd += 7;
						break;
					case 'last':
					case 'previous':
						this.rd -= 7;
						break;
				}
				if (isNaN(this.weekday)) {
					this.weekday = 1;
				}
			}
		},
		'monthFullOrMonthAbbr': {
			'regex': new RegExp('^(' + reMonthFull + '|' + reMonthAbbr + ')', 'i'),
			'name': 'monthfull | monthabbr',
			'callback'(match, month) {
				return this.ymd(this.y, lookupMonth(month), this.d);
			}
		},
		'tzCorrection': {
			'regex': new RegExp('^' + reTzCorrection, 'i'),
			'name': 'tzcorrection',
			'callback'(tzCorrection) {
				return this.zone(processTzCorrection(tzCorrection));
			}
		},
		'tzAbbr': {
			'regex': new RegExp('^' + reTzAbbr),
			'name': 'tzabbr',
			'callback'(match, abbr) {
				const offset = tzAbbrOffsets[abbr.toLowerCase()];
				if (offset == null || Number.isNaN(offset)) {
					return false;
				}
				return this.zone(offset);
			}
		},
		'ago': {
			'regex': /^ago/i,
			'name': 'ago',
			'callback'() {
				this.ry = -this.ry;
				this.rm = -this.rm;
				this.rd = -this.rd;
				this.rh = -this.rh;
				this.ri = -this.ri;
				this.rs = -this.rs;
				this.rf = -this.rf;
			}
		},
		'year4': {
			'regex': new RegExp('^' + reYear4),
			'name': 'year4',
			'callback'(match, year) {
				this.y = +year;
				return true;
			}
		},
		'whitespace': {
			'regex': /^[ .,\t]+/,
			'name': 'whitespace'
		},
		'dateShortWithTimeLong': {
			'regex': new RegExp('^' + reDateNoYear + 't?' + reHour24 + '[:.]' + reMinute + '[:.]' + reSecond, 'i'),
			'name': 'dateshortwithtimelong',
			'callback'(match, month, day, hour, minute, second) {
				return this.ymd(this.y, lookupMonth(month), +day) && this.time(+hour, +minute, +second, 0);
			}
		},
		'dateShortWithTimeLong12': {
			'regex': new RegExp('^' + reDateNoYear + reHour12 + '[:.]' + reMinute + '[:.]' + reSecondlz + reSpaceOpt + reMeridian, 'i'),
			'name': 'dateshortwithtimelong12',
			'callback'(match, month, day, hour, minute, second, meridian) {
				return this.ymd(this.y, lookupMonth(month), +day) && this.time(processMeridian(+hour, meridian), +minute, +second, 0);
			}
		},
		'dateShortWithTimeShort': {
			'regex': new RegExp('^' + reDateNoYear + 't?' + reHour24 + '[:.]' + reMinute, 'i'),
			'name': 'dateshortwithtimeshort',
			'callback'(match, month, day, hour, minute) {
				return this.ymd(this.y, lookupMonth(month), +day) && this.time(+hour, +minute, 0, 0);
			}
		},
		'dateShortWithTimeShort12': {
			'regex': new RegExp('^' + reDateNoYear + reHour12 + '[:.]' + reMinutelz + reSpaceOpt + reMeridian, 'i'),
			'name': 'dateshortwithtimeshort12',
			'callback'(match, month, day, hour, minute, meridian) {
				return this.ymd(this.y, lookupMonth(month), +day) && this.time(processMeridian(+hour, meridian), +minute, 0, 0);
			}
		}
	};
	const resultProto = {
		'y': NaN,
		'm': NaN,
		'd': NaN,
		'h': NaN,
		'i': NaN,
		's': NaN,
		'f': NaN,
		'ry': 0,
		'rm': 0,
		'rd': 0,
		'rh': 0,
		'ri': 0,
		'rs': 0,
		'rf': 0,
		'weekday': NaN,
		'weekdayBehavior': 0,
		'firstOrLastDayOfMonth': 0,
		'z': NaN,
		'dates': 0,
		'times': 0,
		'zones': 0,
		'ymd'(y, m, d) {
			if (this.dates > 0) {
				return false;
			}
			this.dates++;
			this.y = y;
			this.m = m;
			this.d = d;
			return true;
		},
		'time'(h, i, s, f) {
			if (this.times > 0) {
				return false;
			}
			this.times++;
			this.h = h;
			this.i = i;
			this.s = s;
			this.f = f;
			return true;
		},
		'resetTime'() {
			this.h = 0;
			this.i = 0;
			this.s = 0;
			this.f = 0;
			this.times = 0;
			return true;
		},
		'zone'(minutes) {
			if (this.zones <= 1) {
				this.zones++;
				this.z = minutes;
				return true;
			}
			return false;
		},
		'toDate'(relativeTo) {
			if (this.dates && !this.times) {
				this.h = this.i = this.s = this.f = 0;
			}
			if (isNaN(this.y)) {
				this.y = relativeTo.getFullYear();
			}
			if (isNaN(this.m)) {
				this.m = relativeTo.getMonth();
			}
			if (isNaN(this.d)) {
				this.d = relativeTo.getDate();
			}
			if (isNaN(this.h)) {
				this.h = relativeTo.getHours();
			}
			if (isNaN(this.i)) {
				this.i = relativeTo.getMinutes();
			}
			if (isNaN(this.s)) {
				this.s = relativeTo.getSeconds();
			}
			if (isNaN(this.f)) {
				this.f = relativeTo.getMilliseconds();
			}
			switch (this.firstOrLastDayOfMonth) {
				case 1:
					this.d = 1;
					break;
				case -1:
					this.d = 0;
					this.m += 1;
					break;
			}
			if (!isNaN(this.weekday)) {
				const date = new Date(relativeTo.getTime());
				date.setFullYear(this.y, this.m, this.d);
				date.setHours(this.h, this.i, this.s, this.f);
				const dow = date.getDay();
				if (this.weekdayBehavior === 2) {
					if (dow === 0 && this.weekday !== 0) {
						this.weekday = -6;
					}
					if (this.weekday === 0 && dow !== 0) {
						this.weekday = 7;
					}
					this.d -= dow;
					this.d += this.weekday;
				} else {
					let diff = this.weekday - dow;
					if (this.rd < 0 && diff < 0 || this.rd >= 0 && diff <= -this.weekdayBehavior) {
						diff += 7;
					}
					if (this.weekday >= 0) {
						this.d += diff;
					} else {
						this.d -= 7 - (Math.abs(this.weekday) - dow);
					}
					this.weekday = NaN;
				}
			}
			this.y += this.ry;
			this.m += this.rm;
			this.d += this.rd;
			this.h += this.rh;
			this.i += this.ri;
			this.s += this.rs;
			this.f += this.rf;
			this.ry = this.rm = this.rd = 0;
			this.rh = this.ri = this.rs = this.rf = 0;
			const result = new Date(relativeTo.getTime());
			result.setFullYear(this.y, this.m, this.d);
			result.setHours(this.h, this.i, this.s, this.f);
			switch (this.firstOrLastDayOfMonth) {
				case 1:
					result.setDate(1);
					break;
				case -1:
					result.setMonth(result.getMonth() + 1, 0);
					break;
			}
			if (!isNaN(this.z) && result.getTimezoneOffset() !== this.z) {
				result.setUTCFullYear(result.getFullYear(), result.getMonth(), result.getDate());
				result.setUTCHours(result.getHours(), result.getMinutes(), result.getSeconds() - this.z, result.getMilliseconds());
			}
			return result;
		}
	};

	function strtotime(str, now) {
		str = strval(str);
		const nowSeconds = now == null ? Math.floor(Date.now() / 1000) : now;
		const rules = [formats.yesterday, formats.now, formats.noon, formats.midnightOrToday, formats.tomorrow, formats.timestamp, formats.firstOrLastDay, formats.backOrFrontOf, formats.timeTiny12, formats.timeShort12, formats.timeLong12, formats.mssqltime, formats.oracledate, formats.timeShort24, formats.timeLong24, formats.iso8601long, formats.gnuNoColon, formats.iso8601noColon, formats.americanShort, formats.american, formats.iso8601date4, formats.iso8601dateSlash, formats.dateSlash, formats.gnuDateShortOrIso8601date2, formats.gnuDateShorter, formats.dateFull, formats.pointedDate4, formats.pointedDate2, formats.dateNoDay, formats.dateNoDayRev, formats.dateTextual, formats.dateNoYear, formats.dateNoYearRev, formats.dateNoColon, formats.xmlRpc, formats.xmlRpcNoColon, formats.soap, formats.wddx, formats.exif, formats.pgydotd, formats.isoWeekDay, formats.pgTextShort, formats.pgTextReverse, formats.clf, formats.year4, formats.ago, formats.dayText, formats.relativeTextWeek, formats.relativeText, formats.monthFullOrMonthAbbr, formats.tzCorrection, formats.tzAbbr, formats.dateShortWithTimeShort12, formats.dateShortWithTimeLong12, formats.dateShortWithTimeShort, formats.dateShortWithTimeLong, formats.relative, formats.whitespace];
		const result = {
			...resultProto
		};
		while (str.length) {
			let longestMatch = null;
			let finalRule = null;
			for (const format of rules) {
				const match = str.match(format.regex);
				if (match) {
					if (!longestMatch || match[0].length > longestMatch[0].length) {
						longestMatch = match;
						finalRule = format;
					}
				}
			}
			if (!finalRule || !longestMatch) {
				return false;
			}
			if (finalRule.callback && finalRule.callback.apply(result, longestMatch) === false) {
				return false;
			}
			str = str.substr(longestMatch[0].length);
			finalRule = null;
			longestMatch = null;
		}
		return Math.floor(result.toDate(new Date(nowSeconds * 1000)).getTime() / 1000);
	}

	function time() {
		return Math.floor((new Date).getTime() / 1000);
	}

	function basename(path, suffix) {
		let b = path;
		if (b.endsWith('/') || b.endsWith('\\')) {
			b = b.slice(0, -1);
		}
		b = b.replace(/^.*[/\\]/g, '');
		if (typeof suffix === 'string' && b.endsWith(suffix)) {
			b = b.slice(0, -suffix.length);
		}
		return b;
	}

	function dirname(path) {
		return path.replace(/\\/g, '/').replace(/\/[^/]*\/?$/, '');
	}

	function pathinfo(path, options) {
		const tmpArr = {};
		let basenameValue = null;
		let extensionValue = null;
		let filenameValue = null;
		if (!path) {
			return false;
		}
		const optionsInput = options ?? 'PATHINFO_ALL';
		const OPTS = {
			'PATHINFO_DIRNAME': 1,
			'PATHINFO_BASENAME': 2,
			'PATHINFO_EXTENSION': 4,
			'PATHINFO_FILENAME': 8,
			'PATHINFO_ALL': 15
		};
		let resolvedOptions = 0;
		if (typeof optionsInput === 'number') {
			resolvedOptions = optionsInput;
		} else {
			const optionList = Array.isArray(optionsInput) ? optionsInput : [optionsInput];
			for (const option of optionList) {
				const flag = OPTS[option];
				if (flag) {
					resolvedOptions = resolvedOptions | flag;
				}
			}
		}
		const _getExt = function(pathValue) {
			const str = pathValue + '';
			const dotP = str.lastIndexOf('.') + 1;
			return !dotP ? false : dotP !== str.length ? str.substr(dotP) : '';
		};
		if (resolvedOptions & OPTS.PATHINFO_DIRNAME) {
			const dirName = path.replace(/\\/g, '/').replace(/\/[^/]*\/?$/, '');
			tmpArr.dirname = dirName === path ? '.' : dirName;
		}
		if (resolvedOptions & OPTS.PATHINFO_BASENAME) {
			if (basenameValue === null) {
				basenameValue = basename(path);
			}
			tmpArr.basename = basenameValue;
		}
		if (resolvedOptions & OPTS.PATHINFO_EXTENSION) {
			if (basenameValue === null) {
				basenameValue = basename(path);
			}
			if (extensionValue === null) {
				extensionValue = _getExt(basenameValue);
			}
			if (extensionValue !== false) {
				tmpArr.extension = extensionValue;
			}
		}
		if (resolvedOptions & OPTS.PATHINFO_FILENAME) {
			if (basenameValue === null) {
				basenameValue = basename(path);
			}
			if (extensionValue === null) {
				extensionValue = _getExt(basenameValue);
			}
			if (filenameValue === null) {
				filenameValue = basenameValue.slice(0, basenameValue.length - (extensionValue ? extensionValue.length + 1 : extensionValue === false ? 0 : 1));
			}
			tmpArr.filename = filenameValue;
		}
		const values = Object.values(tmpArr).filter((value => typeof value === 'string'));
		if (values.length === 1) {
			return values[0] ?? '';
		}
		return tmpArr;
	}

	function realpath(path) {
		if (typeof window === 'undefined') {
			return null;
		}
		let hasProtocol = false;
		let parts = [];
		const href = window.location.href;
		let normalizedPath = String(path).replace('\\', '/');
		if (normalizedPath.includes('://')) {
			hasProtocol = true;
		}
		if (!hasProtocol) {
			normalizedPath = href.substring(0, href.lastIndexOf('/') + 1) + normalizedPath;
		}
		parts = normalizedPath.split('/');
		const resolvedParts = [];
		for (const part of parts) {
			if (part === '.') {
				continue;
			}
			if (part === '..') {
				if (resolvedParts.length > 3) {
					resolvedParts.pop();
				}
			} else {
				if (resolvedParts.length < 2 || part !== '') {
					resolvedParts.push(part);
				}
			}
		}
		return resolvedParts.join('/');
	}

	function call_user_func(cb, ...parameters) {
		return call_user_func_array(cb, parameters);
	}

	function call_user_func_array(cb, parameters) {
		let func;
		let scope = null;
		try {
			const resolved = resolvePhpCallable(cb, {
				'invalidMessage': 'invalid'
			});
			func = resolved.fn;
			scope = resolved.scope;
		} catch {}
		if (!func && typeof cb === 'string') {
			const globalCandidate = getPhpGlobalEntry(cb);
			if (isPhpCallable(globalCandidate)) {
				func = globalCandidate;
			}
		} else if (!func && Array.isArray(cb)) {
			if (typeof cb[0] === 'string') {
				const globalScope = getPhpGlobalEntry(cb[0]);
				if (isObjectLike(globalScope) || typeof globalScope === 'function') {
					const method = getPhpObjectEntry(globalScope, String(cb[1]));
					if (isPhpCallable(method)) {
						func = method;
					}
					scope = globalScope;
				}
			} else if (isObjectLike(cb[0]) || typeof cb[0] === 'function') {
				const method = getPhpObjectEntry(cb[0], String(cb[1]));
				if (isPhpCallable(method)) {
					func = method;
				}
				scope = cb[0];
			}
		} else if (!func && isPhpCallable(cb)) {
			func = cb;
		}
		if (!func) {
			throw new Error(String(cb) + ' is not a valid function');
		}
		return func.apply(scope, parameters);
	}

	function function_exists(funcName) {
		return typeof getPhpGlobalCallable(funcName) === 'function';
	}

	function get_defined_functions() {
		ensurePhpRuntimeState();
		const arr = [];
		const already = {};
		const globalScope = getPhpGlobalScope();
		for (const i in globalScope) {
			try {
				const topLevelValue = globalScope[i];
				if (typeof topLevelValue === 'function') {
					if (!already[i]) {
						already[i] = 1;
						arr.push(i);
					}
				} else if (typeof topLevelValue === 'object' && topLevelValue !== null) {
					const nestedObject = toPhpArrayObject(topLevelValue);
					for (const j in nestedObject) {
						if (typeof nestedObject[j] === 'function' && !already[j]) {
							already[j] = 1;
							arr.push(j);
						}
					}
				}
			} catch (_e) {}
		}
		return arr;
	}

	function getenv(varname) {
		const processValue = getPhpGlobalEntry('process');
		const hasProcessLike = typeof processValue !== 'undefined';
		if (hasProcessLike) {
			return false;
		}
		if (typeof processValue !== 'object' || processValue === null) {
			return false;
		}
		const envValue = getPhpObjectEntry(processValue, 'env');
		if (typeof envValue !== 'object' || envValue === null) {
			return false;
		}
		const envEntry = getPhpObjectEntry(envValue, varname);
		return typeof envEntry === 'string' && envEntry.length > 0 ? envEntry : false;
	}

	function ini_get(varname) {
		const runtime = ensurePhpRuntimeState();
		const entry = runtime.ini[varname];
		if (entry && entry.local_value !== undefined) {
			if (entry.local_value === null) {
				return '';
			}
			return String(entry.local_value);
		}
		return '';
	}
	const isIniScalar = value => typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean' || value === null;
	const isIniObject = value => typeof value === 'object' && value !== null && !Array.isArray(value);
	const isIniArray = value => Array.isArray(value) && value.every((item => isIniEntryValue(item)));
	const isIniEntryValue = value => isIniScalar(value) || isIniObject(value) || isIniArray(value);
	const isIniValue = value => isIniEntryValue(value);

	function ini_set(varname, newvalue) {
		const runtime = ensurePhpRuntimeState();
		const entry = runtime.ini[varname] ?? (runtime.ini[varname] = {});
		const currentValue = entry.local_value;
		const oldval = typeof currentValue === 'undefined' ? undefined : isIniValue(currentValue) ? currentValue : undefined;
		let normalizedValue = newvalue;
		const lowerStr = String(newvalue).toLowerCase().trim();
		if (newvalue === true || lowerStr === 'on' || lowerStr === '1') {
			normalizedValue = 'on';
		}
		if (newvalue === false || lowerStr === 'off' || lowerStr === '0') {
			normalizedValue = 'off';
		}
		const setArrayValue = () => {
			if (typeof entry.local_value === 'undefined') {
				entry.local_value = [normalizedValue];
				return;
			}
			if (Array.isArray(entry.local_value)) {
				entry.local_value.push(normalizedValue);
				return;
			}
			entry.local_value = [entry.local_value, normalizedValue];
		};
		switch (varname) {
			case 'extension':
				setArrayValue();
				break;
			default:
				entry.local_value = normalizedValue;
				break;
		}
		return oldval;
	}

	function version_compare(v1, v2, operator) {
		let compare = 0;
		const vm = {
			'dev': -6,
			'alpha': -5,
			'a': -5,
			'beta': -4,
			'b': -4,
			'RC': -3,
			'rc': -3,
			'#': -2,
			'p': 1,
			'pl': 1
		};
		const _prepVersion = function(v) {
			let normalized = String(v).replace(/[_\-+]/g, '.');
			normalized = normalized.replace(/([^.\d]+)/g, '.$1.').replace(/\.{2,}/g, '.');
			return !normalized.length ? ['-8'] : normalized.split('.');
		};
		const _numVersion = function(v) {
			if (!v) {
				return 0;
			}
			return isNaN(Number(v)) ? vm[v] ?? -7 : parseInt(v, 10);
		};
		const leftParts = _prepVersion(v1);
		const rightParts = _prepVersion(v2);
		const maxLength = Math.max(leftParts.length, rightParts.length);
		for (let i = 0; i < maxLength; i++) {
			if (leftParts[i] === rightParts[i]) {
				continue;
			}
			const left = _numVersion(leftParts[i]);
			const right = _numVersion(rightParts[i]);
			if (left < right) {
				compare = -1;
				break;
			} else if (left > right) {
				compare = 1;
				break;
			}
		}
		if (!operator) {
			return compare;
		}
		switch (operator) {
			case '>':
			case 'gt':
				return compare > 0;
			case '>=':
			case 'ge':
				return compare >= 0;
			case '<=':
			case 'le':
				return compare <= 0;
			case '===':
			case '=':
			case 'eq':
				return compare === 0;
			case '<>':
			case '!==':
			case 'ne':
				return compare !== 0;
			case '':
			case '<':
			case 'lt':
				return compare < 0;
			default:
				return null;
		}
	}

	function json_last_error() {
		return getPhpRuntimeNumber('last_error_json', 0);
	}

	function abs(mixedNumber) {
		return Math.abs(Number(mixedNumber)) || 0;
	}

	function acos(arg) {
		return Math.acos(arg);
	}

	function acosh(arg) {
		return Math.log(arg + Math.sqrt(arg * arg - 1));
	}

	function asin(arg) {
		return Math.asin(arg);
	}

	function asinh(arg) {
		return Math.log(arg + Math.sqrt(arg * arg + 1));
	}

	function atan(arg) {
		return Math.atan(arg);
	}

	function atan2(y, x) {
		return Math.atan2(y, x);
	}

	function atanh(arg) {
		return 0.5 * Math.log((1 + arg) / (1 - arg));
	}

	function base_convert(number, frombase, tobase) {
		return parseInt(number + '', frombase | 0).toString(tobase | 0);
	}

	function bindec(binaryString) {
		binaryString = (binaryString + '').replace(/[^01]/gi, '');
		return parseInt(binaryString, 2);
	}

	function ceil(value) {
		return Math.ceil(value);
	}

	function cos(arg) {
		return Math.cos(arg);
	}

	function cosh(arg) {
		return (Math.exp(arg) + Math.exp(-arg)) / 2;
	}

	function decbin(number) {
		let normalized = parseInt(String(number), 10);
		if (normalized < 0) {
			normalized = 0xffffffff + normalized + 1;
		}
		return normalized.toString(2);
	}

	function dechex(number) {
		let normalized = parseInt(String(number), 10);
		if (normalized < 0) {
			normalized = 0xffffffff + normalized + 1;
		}
		return normalized.toString(16);
	}

	function decoct(number) {
		let normalized = parseInt(String(number), 10);
		if (normalized < 0) {
			normalized = 0xffffffff + normalized + 1;
		}
		return normalized.toString(8);
	}

	function deg2rad(angle) {
		return angle * 0.017453292519943295;
	}

	function exp(arg) {
		return Math.exp(arg);
	}

	function expm1(x) {
		return x < 1e-5 && x > -1e-5 ? x + 0.5 * x * x : Math.exp(x) - 1;
	}

	function floor(value) {
		return Math.floor(value);
	}

	function fmod(x, y) {
		let tmp;
		let tmp2;
		let p = 0;
		let pY = 0;
		let l = 0.0;
		let l2 = 0.0;
		const normalizedX = Number(x);
		const normalizedY = Number(y);
		tmp = normalizedX.toExponential().match(/^.\.?(.*)e(.+)$/);
		if (!tmp) {
			return NaN;
		}
		p = Number.parseInt(tmp[2] ?? '0', 10) - (tmp[1] ?? '').length;
		tmp = normalizedY.toExponential().match(/^.\.?(.*)e(.+)$/);
		if (!tmp) {
			return NaN;
		}
		pY = Number.parseInt(tmp[2] ?? '0', 10) - (tmp[1] ?? '').length;
		if (pY > p) {
			p = pY;
		}
		tmp2 = normalizedX % normalizedY;
		if (p < -100 || p > 20) {
			l = Math.round(Math.log(tmp2) / Math.log(10));
			l2 = Math.pow(10, l);
			return Number((tmp2 / l2).toFixed(l - p)) * l2;
		} else {
			return parseFloat(tmp2.toFixed(Math.abs(p)));
		}
	}

	function getrandmax() {
		return 2147483647;
	}

	function hexdec(hexString) {
		hexString = (hexString + '').replace(/[^a-f0-9]/gi, '');
		return parseInt(hexString, 16);
	}

	function hypot(x, y) {
		const left = Math.abs(Number(x));
		const right = Math.abs(Number(y));
		let t = Math.min(left, right);
		const max = Math.max(left, right);
		t = t / max;
		return max * Math.sqrt(1 + t * t) || null;
	}

	function is_finite(val) {
		let warningType = '';
		if (val === Infinity || val === -Infinity) {
			return false;
		}
		if (typeof val === 'object') {
			warningType = Array.isArray(val) ? 'array' : 'object';
		} else if (typeof val === 'string' && !/^[+-]?\d/.test(val)) {
			warningType = 'string';
		}
		if (warningType) {
			const msg = 'Warning: is_finite() expects parameter 1 to be double, ' + warningType + ' given';
			throw new Error(msg);
		}
		return true;
	}

	function is_infinite(val) {
		let warningType = '';
		if (val === Infinity || val === -Infinity) {
			return true;
		}
		if (typeof val === 'object') {
			warningType = Array.isArray(val) ? 'array' : 'object';
		} else if (typeof val === 'string' && !/^[+-]?\d/.test(val)) {
			warningType = 'string';
		}
		if (warningType) {
			const msg = 'Warning: is_infinite() expects parameter 1 to be double, ' + warningType + ' given';
			throw new Error(msg);
		}
		return false;
	}

	function is_nan(val) {
		let warningType = '';
		if (typeof val === 'number' && isNaN(val)) {
			return true;
		}
		if (typeof val === 'object') {
			warningType = Array.isArray(val) ? 'array' : 'object';
		} else if (typeof val === 'string' && !/^[+-]?\d/.test(val)) {
			warningType = 'string';
		}
		if (warningType) {
			throw new Error('Warning: is_nan() expects parameter 1 to be double, ' + warningType + ' given');
		}
		return false;
	}

	function log(arg, base) {
		return typeof base === 'undefined' ? Math.log(arg) : Math.log(arg) / Math.log(base);
	}

	function log10(arg) {
		return Math.log(arg) / 2.302585092994046;
	}

	function log1p(x) {
		let ret = 0;
		const n = 50;
		if (x <= -1) {
			return '-INF';
		}
		if (x < 0 || x > 1) {
			return Math.log(1 + x);
		}
		for (let i = 1; i < n; i++) {
			ret += Math.pow(-x, i) / i;
		}
		return -ret;
	}
	const isCollection = value => typeof value === 'object' && value !== null;
	const objectToArray = value => {
		if (Array.isArray(value)) {
			return value;
		}
		const converted = Object.values(value).filter((item => typeof item !== 'undefined'));
		return converted;
	};
	const compareValues = (current, next) => {
		const currentNum = Number(current);
		const nextNum = Number(next);
		if (current === next) {
			return 0;
		}
		if (isCollection(current)) {
			if (isCollection(next)) {
				const currentArray = objectToArray(current);
				const nextArray = objectToArray(next);
				if (nextArray.length > currentArray.length) {
					return 1;
				}
				if (nextArray.length < currentArray.length) {
					return -1;
				}
				for (let index = 0; index < currentArray.length; index += 1) {
					const currentItem = currentArray[index];
					const nextItem = nextArray[index];
					if (typeof currentItem === 'undefined' || typeof nextItem === 'undefined') {
						continue;
					}
					const comparison = compareValues(currentItem, nextItem);
					if (comparison !== 0) {
						return comparison;
					}
				}
				return 0;
			}
			return -1;
		}
		if (isCollection(next)) {
			return 1;
		}
		if (Number.isNaN(nextNum) && !Number.isNaN(currentNum)) {
			if (current === 0) {
				return 0;
			}
			return currentNum < 0 ? 1 : -1;
		}
		if (Number.isNaN(currentNum) && !Number.isNaN(nextNum)) {
			if (next === 0) {
				return 0;
			}
			return nextNum > 0 ? 1 : -1;
		}
		if (typeof current === 'string' && typeof next === 'string' && Number.isNaN(currentNum) && Number.isNaN(nextNum)) {
			return next > current ? 1 : -1;
		}
		return nextNum > currentNum ? 1 : -1;
	};

	function max(...args) {
		if (args.length === 0) {
			throw new Error('At least one value should be passed to max()');
		}
		let values;
		if (args.length === 1) {
			const only = args[0];
			if (typeof only === 'undefined' || !isCollection(only)) {
				throw new Error('Wrong parameter count for max()');
			}
			values = objectToArray(only);
			if (values.length === 0) {
				throw new Error('Array must contain at least one element for max()');
			}
		} else {
			values = args;
		}
		const first = values[0];
		if (typeof first === 'undefined') {
			throw new Error('Array must contain at least one element for max()');
		}
		let result = first;
		for (let index = 1; index < values.length; index += 1) {
			const candidate = values[index];
			if (typeof candidate === 'undefined') {
				continue;
			}
			if (compareValues(result, candidate) === 1) {
				result = candidate;
			}
		}
		return result;
	}

	function min(...args) {
		if (args.length === 0) {
			throw new Error('At least one value should be passed to min()');
		}
		let values;
		if (args.length === 1) {
			const only = args[0];
			if (typeof only === 'undefined' || !isCollection(only)) {
				throw new Error('Wrong parameter count for min()');
			}
			values = objectToArray(only);
			if (values.length === 0) {
				throw new Error('Array must contain at least one element for min()');
			}
		} else {
			values = args;
		}
		const first = values[0];
		if (typeof first === 'undefined') {
			throw new Error('Array must contain at least one element for min()');
		}
		let result = first;
		for (let index = 1; index < values.length; index += 1) {
			const candidate = values[index];
			if (typeof candidate === 'undefined') {
				continue;
			}
			if (compareValues(result, candidate) === -1) {
				result = candidate;
			}
		}
		return result;
	}

	function mt_getrandmax() {
		return 2147483647;
	}

	function mt_rand(...providedArgs) {
		const [min, max] = providedArgs;
		let minValue;
		let maxValue;
		if (providedArgs.length === 0) {
			minValue = 0;
			maxValue = 2147483647;
		} else if (providedArgs.length === 1) {
			throw new Error('Warning: mt_rand() expects exactly 2 parameters, 1 given');
		} else {
			minValue = Number.parseInt(String(min), 10);
			maxValue = Number.parseInt(String(max), 10);
		}
		return Math.floor(Math.random() * (maxValue - minValue + 1)) + minValue;
	}

	function octdec(octString) {
		octString = (octString + '').replace(/[^0-7]/gi, '');
		return parseInt(octString, 8);
	}

	function pi() {
		return 3.141592653589793;
	}

	function pow(base, exp) {
		return Number(Math.pow(base, exp).toPrecision(15));
	}

	function rad2deg(angle) {
		return angle * 57.29577951308232;
	}

	function rand(...providedArgs) {
		const [min, max] = providedArgs;
		let minValue;
		let maxValue;
		if (providedArgs.length === 0) {
			minValue = 0;
			maxValue = 2147483647;
		} else if (providedArgs.length === 1) {
			throw new Error('Warning: rand() expects exactly 2 parameters, 1 given');
		} else {
			minValue = Number(min);
			maxValue = Number(max);
		}
		return Math.floor(Math.random() * (maxValue - minValue + 1)) + minValue;
	}

	function roundToInt(value, mode) {
		let tmp = Math.floor(Math.abs(value) + 0.5);
		if (mode === 'PHP_ROUND_HALF_DOWN' && value === tmp - 0.5 || mode === 'PHP_ROUND_HALF_EVEN' && value === 0.5 + 2 * Math.floor(tmp / 2) || mode === 'PHP_ROUND_HALF_ODD' && value === 0.5 + 2 * Math.floor(tmp / 2) - 1) {
			tmp -= 1;
		}
		return value < 0 ? -tmp : tmp;
	}

	function round(value, precision = 0, mode = 'PHP_ROUND_HALF_UP') {
		let p;
		value = _php_cast_float(value);
		precision = _php_cast_int(precision);
		p = Math.pow(10, precision);
		if (isNaN(value) || !isFinite(value)) {
			return value;
		}
		if (Math.trunc(value) === value && precision >= 0) {
			return value;
		}
		const preRoundPrecision = 14 - Math.floor(Math.log10(Math.abs(value)));
		if (preRoundPrecision > precision && preRoundPrecision - 15 < precision) {
			value = roundToInt(value * Math.pow(10, preRoundPrecision), mode);
			value /= Math.pow(10, Math.abs(precision - preRoundPrecision));
		} else {
			value *= p;
		}
		value = roundToInt(value, mode);
		return value / p;
	}

	function sin(arg) {
		return Math.sin(arg);
	}

	function sinh(arg) {
		return (Math.exp(arg) - Math.exp(-arg)) / 2;
	}

	function sqrt(arg) {
		return Math.sqrt(arg);
	}

	function tan(arg) {
		return Math.tan(arg);
	}

	function tanh(arg) {
		return 1 - 2 / (Math.exp(2 * arg) + 1);
	}

	function pack(format, ...inputArgs) {
		let formatPointer = 0;
		let argumentPointer = 0;
		let result = '';
		let argument = '';
		let i = 0;
		let r = [];
		let instruction = '';
		let quantifier = 1;
		let word = '';
		let precisionBits = 0;
		let exponentBits = 0;
		let extraNullCount = 0;
		let bias = 0;
		let minExp = 0;
		let maxExp = 0;
		let minUnnormExp = 0;
		let status = 0;
		let exp = 0;
		let len = 0;
		let bin = [];
		let signal = 0;
		let n = 0;
		let intPart = 0;
		let floatPart = 0;
		let lastBit = 0;
		let rounded = 0;
		let j = 0;
		let k = 0;
		let tmpResult = '';
		const getRemainingArgumentCount = () => inputArgs.length - argumentPointer;
		const getCurrentArgument = () => inputArgs[argumentPointer];
		const getCurrentNumericArgument = () => Number(getCurrentArgument() ?? 0);
		const getBin = index => bin[index] ?? 0;
		while (formatPointer < format.length) {
			instruction = format.charAt(formatPointer);
			let quantifierText = '';
			formatPointer++;
			while (formatPointer < format.length && /[\d*]/.test(format.charAt(formatPointer))) {
				quantifierText += format.charAt(formatPointer);
				formatPointer++;
			}
			if (quantifierText === '') {
				quantifier = 1;
			} else if (quantifierText === '*') {
				quantifier = '*';
			} else {
				quantifier = Number.parseInt(quantifierText, 10);
			}
			switch (instruction) {
				case 'a':
				case 'A': {
					if (typeof getCurrentArgument() === 'undefined') {
						throw new Error('Warning:  pack() Type ' + instruction + ': not enough arguments');
					}
					argument = String(getCurrentArgument());
					const argString = String(argument);
					const count = quantifier === '*' ? argString.length : quantifier;
					for (i = 0; i < count; i++) {
						if (typeof argString[i] === 'undefined') {
							if (instruction === 'a') {
								result += String.fromCharCode(0);
							} else {
								result += ' ';
							}
						} else {
							result += argString[i];
						}
					}
					argumentPointer++;
					break;
				}
				case 'h':
				case 'H': {
					if (typeof getCurrentArgument() === 'undefined') {
						throw new Error('Warning: pack() Type ' + instruction + ': not enough arguments');
					}
					argument = String(getCurrentArgument());
					const argString = String(argument);
					const count = quantifier === '*' ? argString.length : quantifier;
					if (count > argString.length) {
						throw new Error('Warning: pack() Type ' + instruction + ': not enough characters in string');
					}
					for (i = 0; i < count; i += 2) {
						const first = argString[i] ?? '';
						const second = i + 1 >= count || typeof argString[i + 1] === 'undefined' ? '0' : argString[i + 1] ?? '0';
						word = first + second;
						if (instruction === 'h') {
							word = (word[1] ?? '0') + (word[0] ?? '0');
						}
						result += String.fromCharCode(Number.parseInt(word, 16));
					}
					argumentPointer++;
					break;
				}
				case 'c':
				case 'C': {
					const count = quantifier === '*' ? getRemainingArgumentCount() : quantifier;
					if (count > getRemainingArgumentCount()) {
						throw new Error('Warning:  pack() Type ' + instruction + ': too few arguments');
					}
					for (i = 0; i < count; i++) {
						result += String.fromCharCode(getCurrentNumericArgument());
						argumentPointer++;
					}
					break;
				}
				case 's':
				case 'S':
				case 'v': {
					const count = quantifier === '*' ? getRemainingArgumentCount() : quantifier;
					if (count > getRemainingArgumentCount()) {
						throw new Error('Warning:  pack() Type ' + instruction + ': too few arguments');
					}
					for (i = 0; i < count; i++) {
						const value = getCurrentNumericArgument();
						result += String.fromCharCode(value & 0xff);
						result += String.fromCharCode(value >> 8 & 0xff);
						argumentPointer++;
					}
					break;
				}
				case 'n': {
					const count = quantifier === '*' ? getRemainingArgumentCount() : quantifier;
					if (count > getRemainingArgumentCount()) {
						throw new Error('Warning: pack() Type ' + instruction + ': too few arguments');
					}
					for (i = 0; i < count; i++) {
						const value = getCurrentNumericArgument();
						result += String.fromCharCode(value >> 8 & 0xff);
						result += String.fromCharCode(value & 0xff);
						argumentPointer++;
					}
					break;
				}
				case 'i':
				case 'I':
				case 'l':
				case 'L':
				case 'V': {
					const count = quantifier === '*' ? getRemainingArgumentCount() : quantifier;
					if (count > getRemainingArgumentCount()) {
						throw new Error('Warning:  pack() Type ' + instruction + ': too few arguments');
					}
					for (i = 0; i < count; i++) {
						const value = getCurrentNumericArgument();
						result += String.fromCharCode(value & 0xff);
						result += String.fromCharCode(value >> 8 & 0xff);
						result += String.fromCharCode(value >> 16 & 0xff);
						result += String.fromCharCode(value >> 24 & 0xff);
						argumentPointer++;
					}
					break;
				}
				case 'N': {
					const count = quantifier === '*' ? getRemainingArgumentCount() : quantifier;
					if (count > getRemainingArgumentCount()) {
						throw new Error('Warning: pack() Type ' + instruction + ': too few arguments');
					}
					for (i = 0; i < count; i++) {
						const value = getCurrentNumericArgument();
						result += String.fromCharCode(value >> 24 & 0xff);
						result += String.fromCharCode(value >> 16 & 0xff);
						result += String.fromCharCode(value >> 8 & 0xff);
						result += String.fromCharCode(value & 0xff);
						argumentPointer++;
					}
					break;
				}
				case 'f':
				case 'd': {
					precisionBits = 23;
					exponentBits = 8;
					if (instruction === 'd') {
						precisionBits = 52;
						exponentBits = 11;
					}
					const count = quantifier === '*' ? getRemainingArgumentCount() : quantifier;
					if (count > getRemainingArgumentCount()) {
						throw new Error('Warning:  pack() Type ' + instruction + ': too few arguments');
					}
					for (i = 0; i < count; i++) {
						argument = String(getCurrentArgument() ?? '');
						bias = Math.pow(2, exponentBits - 1) - 1;
						minExp = -bias + 1;
						maxExp = bias;
						minUnnormExp = minExp - precisionBits;
						n = Number.parseFloat(String(argument));
						status = Number.isNaN(n) || n === -Infinity || n === Infinity ? n : 0;
						exp = 0;
						len = 2 * bias + 1 + precisionBits + 3;
						bin = new Array(len);
						signal = (n = status !== 0 ? 0 : n) < 0 ? 1 : 0;
						n = Math.abs(n);
						intPart = Math.floor(n);
						floatPart = n - intPart;
						for (k = len; k;) {
							bin[--k] = 0;
						}
						for (k = bias + 2; intPart && k;) {
							bin[--k] = intPart % 2;
							intPart = Math.floor(intPart / 2);
						}
						for (k = bias + 1; floatPart > 0 && k; --floatPart) {
							bin[++k] = Number((floatPart *= 2) >= 1);
						}
						for (k = -1; ++k < len && !getBin(k);) {}
						const key = (lastBit = precisionBits - 1 + (k = (exp = bias + 1 - k) >= minExp && exp <= maxExp ? k + 1 : bias + 1 - (exp = minExp - 1))) + 1;
						if (getBin(key)) {
							if (!(rounded = getBin(lastBit))) {
								for (j = lastBit + 2; !rounded && j < len; rounded = getBin(j++)) {}
							}
							for (j = lastBit + 1; rounded && --j >= 0;
								(bin[j] = Number(!getBin(j))) && (rounded = 0)) {}
						}
						for (k = k - 2 < 0 ? -1 : k - 3; ++k < len && !getBin(k);) {}
						if ((exp = bias + 1 - k) >= minExp && exp <= maxExp) {
							++k;
						} else if (exp < minExp) {
							if (exp !== bias + 1 - len && exp < minUnnormExp) {}
							k = bias + 1 - (exp = minExp - 1);
						}
						if (intPart || status !== 0) {
							exp = maxExp + 1;
							k = bias + 2;
							if (status === -Infinity) {
								signal = 1;
							} else if (Number.isNaN(status)) {
								bin[k] = 1;
							}
						}
						n = Math.abs(exp + bias);
						tmpResult = '';
						for (j = exponentBits + 1; --j;) {
							tmpResult = n % 2 + tmpResult;
							n >>= 1;
						}
						n = 0;
						j = 0;
						k = (tmpResult = (signal ? '1' : '0') + tmpResult + bin.slice(k, k + precisionBits).join('')).length;
						r = [];
						for (; k;) {
							n += (1 << j) * Number(tmpResult.charAt(--k));
							if (j === 7) {
								r.push(String.fromCharCode(n));
								n = 0;
							}
							j = (j + 1) % 8;
						}
						r.push(n ? String.fromCharCode(n) : '');
						result += r.join('');
						argumentPointer++;
					}
					break;
				}
				case 'x': {
					if (quantifier === '*') {
						throw new Error('Warning: pack(): Type x: \'*\' ignored');
					}
					for (i = 0; i < quantifier; i++) {
						result += String.fromCharCode(0);
					}
					break;
				}
				case 'X': {
					if (quantifier === '*') {
						throw new Error('Warning: pack(): Type X: \'*\' ignored');
					}
					for (i = 0; i < quantifier; i++) {
						if (result.length === 0) {
							throw new Error('Warning: pack(): Type X:' + ' outside of string');
						}
						result = result.slice(0, -1);
					}
					break;
				}
				case '@': {
					if (quantifier === '*') {
						throw new Error('Warning: pack(): Type X: \'*\' ignored');
					}
					if (quantifier > result.length) {
						extraNullCount = quantifier - result.length;
						for (i = 0; i < extraNullCount; i++) {
							result += String.fromCharCode(0);
						}
					}
					if (quantifier < result.length) {
						result = result.slice(0, quantifier);
					}
					break;
				}
				default:
					throw new Error('Warning: pack() Type ' + instruction + ': invalid format code');
			}
		}
		if (argumentPointer < inputArgs.length) {
			throw new Error('Warning: pack(): ' + (inputArgs.length - argumentPointer) + ' arguments unused');
		}
		return result;
	}

	function uniqid(prefix, moreEntropy) {
		const normalizedPrefix = prefix ?? '';
		let retId = '';
		const formatSeed = (seed, reqWidth) => {
			const hexSeed = Number.parseInt(String(seed), 10).toString(16);
			if (reqWidth < hexSeed.length) {
				return hexSeed.slice(hexSeed.length - reqWidth);
			}
			if (reqWidth > hexSeed.length) {
				return new Array(1 + (reqWidth - hexSeed.length)).join('0') + hexSeed;
			}
			return hexSeed;
		};
		let uniqidSeed = getPhpRuntimeNumber('uniqidSeed', Math.floor(Math.random() * 0x75bcd15));
		uniqidSeed++;
		setPhpRuntimeEntry('uniqidSeed', uniqidSeed);
		retId = normalizedPrefix;
		retId += formatSeed(Number.parseInt(String((new Date).getTime() / 1000), 10), 8);
		retId += formatSeed(uniqidSeed, 5);
		if (moreEntropy) {
			retId += (Math.random() * 10).toFixed(8).toString();
		}
		return retId;
	}
	const STRING_CODES = new Set(['a', 'A', 'h', 'H']);

	function toByteArray(input) {
		return Uint8Array.from(Array.from(input, (char => char.charCodeAt(0) & 0xff)));
	}

	function parseFormat(format) {
		const segments = String(format).split('/').map((segment => segment.trim())).filter(Boolean);
		const parsed = [];
		for (const segment of segments) {
			const code = segment[0] ?? '';
			if (!/[aAhHcCsSvVnNiIlLfdxX@CN]/.test(code)) {
				return null;
			}
			let cursor = 1;
			let quantifierText = '';
			while (cursor < segment.length && /[\d*]/.test(segment[cursor] ?? '')) {
				quantifierText += segment[cursor];
				cursor += 1;
			}
			const label = segment.slice(cursor);
			const quantifier = quantifierText === '' ? 1 : quantifierText === '*' ? '*' : Number.parseInt(quantifierText, 10);
			if (typeof quantifier === 'number' && (!Number.isFinite(quantifier) || quantifier < 0)) {
				return null;
			}
			parsed.push({
				'code': code,
				'quantifier': quantifier,
				'label': label
			});
		}
		return parsed;
	}

	function resolveCount(quantifier, cursor, bytesPerValue, totalLength) {
		if (quantifier !== '*') {
			return quantifier;
		}
		if (bytesPerValue <= 0) {
			return 0;
		}
		return Math.floor((totalLength - cursor) / bytesPerValue);
	}

	function addResult(target, nextNumericKey, label, index, count, value) {
		if (label) {
			const key = count === 1 && index === 0 ? label : `${label}${index + 1}`;
			target[key] = value;
			return;
		}
		target[String(nextNumericKey.value)] = value;
		nextNumericKey.value += 1;
	}

	function readUInt16(bytes, cursor, littleEndian) {
		return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint16(cursor, littleEndian);
	}

	function readInt16(bytes, cursor, littleEndian) {
		return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getInt16(cursor, littleEndian);
	}

	function readUInt32(bytes, cursor, littleEndian) {
		return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(cursor, littleEndian);
	}

	function readInt32(bytes, cursor, littleEndian) {
		return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getInt32(cursor, littleEndian);
	}

	function unpack(format, data) {
		const parsed = parseFormat(format);
		if (!parsed) {
			return false;
		}
		const bytes = toByteArray(String(data));
		const out = {};
		const nextNumericKey = {
			'value': 1
		};
		let cursor = 0;
		for (const segment of parsed) {
			const {
				'code': code,
				'quantifier': quantifier,
				'label': label
			} = segment;
			if (code === 'x') {
				const count = quantifier === '*' ? bytes.length - cursor : quantifier;
				cursor += count;
				if (cursor > bytes.length) {
					return false;
				}
				continue;
			}
			if (code === 'X') {
				const count = quantifier === '*' ? cursor : quantifier;
				cursor -= count;
				if (cursor < 0) {
					return false;
				}
				continue;
			}
			if (code === '@') {
				cursor = quantifier === '*' ? bytes.length : quantifier;
				if (cursor < 0 || cursor > bytes.length) {
					return false;
				}
				continue;
			}
			if (STRING_CODES.has(code)) {
				const nibbleMode = code === 'h' || code === 'H';
				const unitSize = nibbleMode ? 0.5 : 1;
				const requested = quantifier === '*' ? nibbleMode ? (bytes.length - cursor) * 2 : bytes.length - cursor : quantifier;
				if (!Number.isFinite(requested) || requested < 0) {
					return false;
				}
				if (nibbleMode) {
					const byteCount = Math.ceil(requested * unitSize);
					if (cursor + byteCount > bytes.length) {
						return false;
					}
					let hex = '';
					for (let i = 0; i < byteCount; i++) {
						const pair = (bytes[cursor + i] ?? 0).toString(16).padStart(2, '0');
						hex += code === 'h' ? `${pair[1] ?? '0'}${pair[0] ?? '0'}` : pair;
					}
					addResult(out, nextNumericKey, label, 0, 1, hex.slice(0, requested));
					cursor += byteCount;
					continue;
				}
				if (cursor + requested > bytes.length) {
					return false;
				}
				const chunk = String.fromCharCode(...bytes.slice(cursor, cursor + requested));
				const normalized = code === 'a' ? chunk.replace(/\0+$/g, '') : chunk.replace(/[\0 ]+$/g, '');
				addResult(out, nextNumericKey, label, 0, 1, normalized);
				cursor += requested;
				continue;
			}
			let bytesPerValue = 1;
			switch (code) {
				case 's':
				case 'S':
				case 'v':
				case 'n':
					bytesPerValue = 2;
					break;
				case 'i':
				case 'I':
				case 'l':
				case 'L':
				case 'V':
				case 'N':
				case 'f':
					bytesPerValue = 4;
					break;
				case 'd':
					bytesPerValue = 8;
					break;
				default:
					bytesPerValue = 1;
					break;
			}
			const count = resolveCount(quantifier, cursor, bytesPerValue, bytes.length);
			for (let i = 0; i < count; i++) {
				if (cursor + bytesPerValue > bytes.length) {
					return false;
				}
				let value;
				switch (code) {
					case 'c': {
						const byte = bytes[cursor] ?? 0;
						value = byte > 0x7f ? byte - 0x100 : byte;
						break;
					}
					case 'C':
						value = bytes[cursor] ?? 0;
						break;
					case 's':
						value = readInt16(bytes, cursor, true);
						break;
					case 'S':
					case 'v':
						value = readUInt16(bytes, cursor, true);
						break;
					case 'n':
						value = readUInt16(bytes, cursor, false);
						break;
					case 'i':
					case 'l':
						value = readInt32(bytes, cursor, true);
						break;
					case 'I':
					case 'L':
					case 'V':
						value = readUInt32(bytes, cursor, true);
						break;
					case 'N':
						value = readUInt32(bytes, cursor, false);
						break;
					case 'f':
						value = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getFloat32(cursor, true);
						break;
					case 'd':
						value = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getFloat64(cursor, true);
						break;
					default:
						return false;
				}
				addResult(out, nextNumericKey, label, i, count, value);
				cursor += bytesPerValue;
			}
		}
		return out;
	}

	function inet_ntop(a) {
		let i = 0;
		let m = '';
		const c = [];
		const address = String(a);
		if (address.length === 4) {
			return [address.charCodeAt(0), address.charCodeAt(1), address.charCodeAt(2), address.charCodeAt(3)].join('.');
		} else if (address.length === 16) {
			for (i = 0; i < 16; i++) {
				c.push(((address.charCodeAt(i++) << 8) + address.charCodeAt(i)).toString(16));
			}
			return c.join(':').replace(/((^|:)0(?=:|$))+:?/g, (function(t) {
				m = t.length > m.length ? t : m;
				return t;
			})).replace(m || ' ', '::');
		} else {
			return false;
		}
	}

	function inet_pton(a) {
		const f = String.fromCharCode;
		const ipv4Match = a.match(/^(?:\d{1,3}(?:\.|$)){4}/);
		if (ipv4Match) {
			const octets = ipv4Match[0].split('.').slice(0, 4).map((part => Number.parseInt(part, 10)));
			const [a0, a1, a2, a3] = octets;
			if (a0 === undefined || a1 === undefined || a2 === undefined || a3 === undefined || octets.some((octet => Number.isNaN(octet) || octet < 0 || octet > 255))) {
				return false;
			}
			const packed = f(a0, a1, a2, a3);
			return packed.length === 4 ? packed : false;
		}
		if (a.length > 39) {
			return false;
		}
		const segments = a.split('::');
		if (segments.length > 2) {
			return false;
		}
		const reHexDigits = /^[\da-f]{1,4}$/i;
		const packedSegments = [];
		for (const segment of segments) {
			if (segment.length === 0) {
				packedSegments.push('');
				continue;
			}
			const hextets = segment.split(':');
			let packed = '';
			for (const hextetSource of hextets) {
				const hextet = hextetSource;
				if (!reHexDigits.test(hextet)) {
					return false;
				}
				const parsedHextet = parseInt(hextet, 16);
				if (Number.isNaN(parsedHextet)) {
					return false;
				}
				packed += f(parsedHextet >> 8, parsedHextet & 0xff);
			}
			packedSegments.push(packed);
		}
		const bytesLength = packedSegments.reduce(((total, part) => total + part.length), 0);
		if (bytesLength > 16) {
			return false;
		}
		if (segments.length === 1 && bytesLength !== 16) {
			return false;
		}
		return packedSegments.join('\0'.repeat(16 - bytesLength));
	}

	function ip2long(argIP) {
		const pattern = new RegExp(['^([1-9]\\d*|0[0-7]*|0x[\\da-f]+)', '(?:\\.([1-9]\\d*|0[0-7]*|0x[\\da-f]+))?', '(?:\\.([1-9]\\d*|0[0-7]*|0x[\\da-f]+))?', '(?:\\.([1-9]\\d*|0[0-7]*|0x[\\da-f]+))?$'].join(''), 'i');
		const matchedParts = argIP.match(pattern);
		if (!matchedParts) {
			return false;
		}
		let partCount = 0;
		const values = [0, 0, 0, 0];
		for (let i = 0; i < 4; i += 1) {
			const part = matchedParts[i + 1] ?? '';
			partCount += part.length > 0 ? 1 : 0;
			values[i] = Number.parseInt(part) || 0;
		}
		const overflow = [values[0], values[1], values[2], values[3], 256, 256, 256, 256];
		if (partCount === 1) {
			overflow[4] *= Math.pow(256, 3);
		} else if (partCount === 2) {
			overflow[5] *= Math.pow(256, 2);
		} else if (partCount === 3) {
			overflow[6] *= 256;
		}
		if (overflow[0] >= overflow[4] || overflow[1] >= overflow[5] || overflow[2] >= overflow[6] || overflow[3] >= overflow[7]) {
			return false;
		}
		return values[0] * (partCount === 1 ? 1 : 16777216) + values[1] * (partCount <= 2 ? 1 : 65536) + values[2] * (partCount <= 3 ? 1 : 256) + values[3];
	}

	function long2ip(ip) {
		if (!isFinite(ip)) {
			return false;
		}
		return [ip >>> 24 & 0xff, ip >>> 16 & 0xff, ip >>> 8 & 0xff, ip & 0xff].join('.');
	}

	function setcookie(name, value, expires, path, domain, secure) {
		return setrawcookie(name, encodeURIComponent(value), expires, path, domain, secure);
	}

	function setrawcookie(name, value, expires, path, domain, secure) {
		if (typeof window === 'undefined') {
			return true;
		}
		let normalizedExpires = expires;
		if (typeof normalizedExpires === 'string' && /^\d+$/.test(normalizedExpires)) {
			normalizedExpires = parseInt(normalizedExpires, 10);
		}
		if (normalizedExpires instanceof Date) {
			normalizedExpires = normalizedExpires.toUTCString();
		} else if (typeof normalizedExpires === 'number') {
			normalizedExpires = new Date(normalizedExpires * 1e3).toUTCString();
		}
		const parts = [name + '=' + value];
		if (normalizedExpires) {
			parts.push('expires=' + normalizedExpires);
		}
		if (path) {
			parts.push('path=' + path);
		}
		if (domain) {
			parts.push('domain=' + domain);
		}
		if (secure) {
			parts.push('secure');
		}
		window.document.cookie = parts.join(';');
		return true;
	}

	function preg_match(regex, str) {
		return new RegExp(regex).test(str);
	}

	function preg_quote(str, delimiter) {
		return strval(str).replace(new RegExp('[.\\\\+*?\\[\\^\\]$(){}=!<>|:\\' + (delimiter || '') + '-]', 'g'), '\\$&');
	}

	function preg_replace(pattern, replacement, string) {
		const delimiter = pattern.charAt(0);
		const lastDelimiterIndex = pattern.lastIndexOf(delimiter);
		let _flag = pattern.substr(lastDelimiterIndex + 1);
		_flag = _flag !== '' ? _flag : 'g';
		const _pattern = pattern.substr(1, lastDelimiterIndex - 1);
		const regex = new RegExp(_pattern, _flag);
		const result = string.replace(regex, replacement);
		return result;
	}

	function addcslashes(str, charlist) {
		let target = '';
		const chrs = [];
		let i = 0;
		let j = 0;
		let c = '';
		let next = '';
		let rangeBegin = '';
		let rangeEnd = '';
		let chr = '';
		let begin = 0;
		let end = 0;
		let octalLength = 0;
		let postOctalPos = 0;
		let cca = 0;
		let escHexGrp = null;
		let encoded = '';
		const percentHex = /%([\dA-Fa-f]+)/g;
		const _pad = function(n, c) {
			const nString = String(n);
			if (nString.length < c) {
				return new Array(c - nString.length + 1).join('0') + nString;
			}
			return nString;
		};
		for (i = 0; i < charlist.length; i++) {
			c = charlist.charAt(i);
			next = charlist.charAt(i + 1);
			if (c === '\\' && next && /\d/.test(next)) {
				const rangeBeginMatch = charlist.slice(i + 1).match(/^\d+/);
				if (!rangeBeginMatch?.[0]) {
					continue;
				}
				rangeBegin = rangeBeginMatch[0];
				octalLength = rangeBegin.length;
				postOctalPos = i + octalLength + 1;
				if (charlist.charAt(postOctalPos) + charlist.charAt(postOctalPos + 1) === '..') {
					begin = rangeBegin.charCodeAt(0);
					if (/\\\d/.test(charlist.charAt(postOctalPos + 2) + charlist.charAt(postOctalPos + 3))) {
						const rangeEndMatch = charlist.slice(postOctalPos + 3).match(/^\d+/);
						if (!rangeEndMatch?.[0]) {
							throw new Error('Range with no end point');
						}
						rangeEnd = rangeEndMatch[0];
						i += 1;
					} else if (charlist.charAt(postOctalPos + 2)) {
						rangeEnd = charlist.charAt(postOctalPos + 2);
					} else {
						throw new Error('Range with no end point');
					}
					end = rangeEnd.charCodeAt(0);
					if (end > begin) {
						for (j = begin; j <= end; j++) {
							chrs.push(String.fromCharCode(j));
						}
					} else {
						chrs.push('.', rangeBegin, rangeEnd);
					}
					i += rangeEnd.length + 2;
				} else {
					chr = String.fromCharCode(parseInt(rangeBegin, 8));
					chrs.push(chr);
				}
				i += octalLength;
			} else if (next + charlist.charAt(i + 2) === '..') {
				rangeBegin = c;
				begin = rangeBegin.charCodeAt(0);
				if (/\\\d/.test(charlist.charAt(i + 3) + charlist.charAt(i + 4))) {
					const rangeEndMatch = charlist.slice(i + 4).match(/^\d+/);
					if (!rangeEndMatch?.[0]) {
						throw new Error('Range with no end point');
					}
					rangeEnd = rangeEndMatch[0];
					i += 1;
				} else if (charlist.charAt(i + 3)) {
					rangeEnd = charlist.charAt(i + 3);
				} else {
					throw new Error('Range with no end point');
				}
				end = rangeEnd.charCodeAt(0);
				if (end > begin) {
					for (j = begin; j <= end; j++) {
						chrs.push(String.fromCharCode(j));
					}
				} else {
					chrs.push('.', rangeBegin, rangeEnd);
				}
				i += rangeEnd.length + 2;
			} else {
				chrs.push(c);
			}
		}
		for (i = 0; i < str.length; i++) {
			c = str.charAt(i);
			if (chrs.includes(c)) {
				target += '\\';
				cca = c.charCodeAt(0);
				if (cca < 32 || cca > 126) {
					switch (c) {
						case '\n':
							target += 'n';
							break;
						case '\t':
							target += 't';
							break;
						case '\r':
							target += 'r';
							break;
						case '\x07':
							target += 'a';
							break;
						case '\v':
							target += 'v';
							break;
						case '\b':
							target += 'b';
							break;
						case '\f':
							target += 'f';
							break;
						default:
							encoded = encodeURIComponent(c);
							percentHex.lastIndex = 0;
							if ((escHexGrp = percentHex.exec(encoded)) !== null) {
								const hexGroup = escHexGrp[1];
								if (hexGroup) {
									target += _pad(parseInt(hexGroup, 16).toString(8), 3);
								}
							}
							while ((escHexGrp = percentHex.exec(encoded)) !== null) {
								const hexGroup = escHexGrp[1];
								if (hexGroup) {
									target += '\\' + _pad(parseInt(hexGroup, 16).toString(8), 3);
								}
							}
							break;
					}
				} else {
					target += c;
				}
			} else {
				target += c;
			}
		}
		return target;
	}

	function addslashes(str) {
		return strval(str).replace(/[\\"']/g, '\\$&').replace(/\u0000/g, '\\0');
	}

	function bin2hex(s) {
		const encoder = new TextEncoder;
		const bytes = encoder.encode(s);
		let hex = '';
		for (const byte of bytes) {
			hex += byte.toString(16).padStart(2, '0');
		}
		return hex;
	}

	function chr(codePt) {
		if (codePt > 0xffff) {
			codePt -= 0x10000;
			return String.fromCharCode(0xd800 + (codePt >> 10), 0xdc00 + (codePt & 0x3ff));
		}
		return String.fromCharCode(codePt);
	}

	function chunk_split(body, chunklen, end) {
		const parsedChunklen = Number.parseInt(String(chunklen ?? 76), 10) || 76;
		const splitEnd = end || '\r\n';
		if (parsedChunklen < 1) {
			return false;
		}
		const chunks = body.match(new RegExp(`.{0,${parsedChunklen}}`, 'g')) ?? [];
		return chunks.join(splitEnd);
	}

	function convert_uuencode(str) {
		const chr = function(c) {
			return String.fromCharCode(c);
		};
		if (!str || str === '') {
			return chr(0);
		} else if (!isScalar(str)) {
			return false;
		}
		const source = String(str);
		let c = 0;
		let u = 0;
		let a = 0;
		let encoded = '';
		let tmp1 = '';
		let tmp2 = '';
		let bytes = [];
		const chunk = function() {
			bytes = source.substr(u, 45).split('').map((char => char.charCodeAt(0)));
			return bytes.length || 0;
		};
		while ((c = chunk()) !== 0) {
			u += 45;
			encoded += chr(c + 32);
			for (const byte of bytes) {
				tmp1 = byte.toString(2);
				while (tmp1.length < 8) {
					tmp1 = '0' + tmp1;
				}
				tmp2 += tmp1;
			}
			while (tmp2.length % 6) {
				tmp2 = tmp2 + '0';
			}
			for (let i = 0; i <= tmp2.length / 6 - 1; i++) {
				tmp1 = tmp2.substr(a, 6);
				if (tmp1 === '000000') {
					encoded += chr(96);
				} else {
					encoded += chr(parseInt(tmp1, 2) + 32);
				}
				a += 6;
			}
			a = 0;
			tmp2 = '';
			encoded += '\n';
		}
		encoded += chr(96) + '\n';
		return encoded;
	}

	function count_chars(str, mode = 0) {
		const result = {};
		let i = 0;
		const groupedChars = ('' + str).split('').sort().join('').match(/(.)\1*/g) || [];
		if (mode === 3) {
			let presentChars = '';
			for (i = 0; i !== groupedChars.length; i += 1) {
				const grouped = groupedChars[i];
				if (grouped === undefined) {
					continue;
				}
				presentChars += grouped.slice(0, 1);
			}
			return presentChars;
		}
		if ((mode & 1) === 0) {
			for (i = 0; i !== 256; i++) {
				result[i] = 0;
			}
		}
		if (mode === 2 || mode === 4) {
			for (i = 0; i !== groupedChars.length; i += 1) {
				const grouped = groupedChars[i];
				if (grouped === undefined) {
					continue;
				}
				delete result[grouped.charCodeAt(0)];
			}
			if (mode === 4) {
				let absentChars = '';
				for (const key of Object.keys(result)) {
					absentChars += String.fromCharCode(Number(key));
				}
				return absentChars;
			}
			for (const key of Object.keys(result)) {
				result[key] = 0;
			}
		} else {
			for (i = 0; i !== groupedChars.length; i += 1) {
				const grouped = groupedChars[i];
				if (grouped === undefined) {
					continue;
				}
				result[grouped.charCodeAt(0)] = grouped.length;
			}
		}
		return result;
	}

	function crc32(str) {
		str = unescape(encodeURIComponentstrval(str));
		const table = ['00000000', '77073096', 'EE0E612C', '990951BA', '076DC419', '706AF48F', 'E963A535', '9E6495A3', '0EDB8832', '79DCB8A4', 'E0D5E91E', '97D2D988', '09B64C2B', '7EB17CBD', 'E7B82D07', '90BF1D91', '1DB71064', '6AB020F2', 'F3B97148', '84BE41DE', '1ADAD47D', '6DDDE4EB', 'F4D4B551', '83D385C7', '136C9856', '646BA8C0', 'FD62F97A', '8A65C9EC', '14015C4F', '63066CD9', 'FA0F3D63', '8D080DF5', '3B6E20C8', '4C69105E', 'D56041E4', 'A2677172', '3C03E4D1', '4B04D447', 'D20D85FD', 'A50AB56B', '35B5A8FA', '42B2986C', 'DBBBC9D6', 'ACBCF940', '32D86CE3', '45DF5C75', 'DCD60DCF', 'ABD13D59', '26D930AC', '51DE003A', 'C8D75180', 'BFD06116', '21B4F4B5', '56B3C423', 'CFBA9599', 'B8BDA50F', '2802B89E', '5F058808', 'C60CD9B2', 'B10BE924', '2F6F7C87', '58684C11', 'C1611DAB', 'B6662D3D', '76DC4190', '01DB7106', '98D220BC', 'EFD5102A', '71B18589', '06B6B51F', '9FBFE4A5', 'E8B8D433', '7807C9A2', '0F00F934', '9609A88E', 'E10E9818', '7F6A0DBB', '086D3D2D', '91646C97', 'E6635C01', '6B6B51F4', '1C6C6162', '856530D8', 'F262004E', '6C0695ED', '1B01A57B', '8208F4C1', 'F50FC457', '65B0D9C6', '12B7E950', '8BBEB8EA', 'FCB9887C', '62DD1DDF', '15DA2D49', '8CD37CF3', 'FBD44C65', '4DB26158', '3AB551CE', 'A3BC0074', 'D4BB30E2', '4ADFA541', '3DD895D7', 'A4D1C46D', 'D3D6F4FB', '4369E96A', '346ED9FC', 'AD678846', 'DA60B8D0', '44042D73', '33031DE5', 'AA0A4C5F', 'DD0D7CC9', '5005713C', '270241AA', 'BE0B1010', 'C90C2086', '5768B525', '206F85B3', 'B966D409', 'CE61E49F', '5EDEF90E', '29D9C998', 'B0D09822', 'C7D7A8B4', '59B33D17', '2EB40D81', 'B7BD5C3B', 'C0BA6CAD', 'EDB88320', '9ABFB3B6', '03B6E20C', '74B1D29A', 'EAD54739', '9DD277AF', '04DB2615', '73DC1683', 'E3630B12', '94643B84', '0D6D6A3E', '7A6A5AA8', 'E40ECF0B', '9309FF9D', '0A00AE27', '7D079EB1', 'F00F9344', '8708A3D2', '1E01F268', '6906C2FE', 'F762575D', '806567CB', '196C3671', '6E6B06E7', 'FED41B76', '89D32BE0', '10DA7A5A', '67DD4ACC', 'F9B9DF6F', '8EBEEFF9', '17B7BE43', '60B08ED5', 'D6D6A3E8', 'A1D1937E', '38D8C2C4', '4FDFF252', 'D1BB67F1', 'A6BC5767', '3FB506DD', '48B2364B', 'D80D2BDA', 'AF0A1B4C', '36034AF6', '41047A60', 'DF60EFC3', 'A867DF55', '316E8EEF', '4669BE79', 'CB61B38C', 'BC66831A', '256FD2A0', '5268E236', 'CC0C7795', 'BB0B4703', '220216B9', '5505262F', 'C5BA3BBE', 'B2BD0B28', '2BB45A92', '5CB36A04', 'C2D7FFA7', 'B5D0CF31', '2CD99E8B', '5BDEAE1D', '9B64C2B0', 'EC63F226', '756AA39C', '026D930A', '9C0906A9', 'EB0E363F', '72076785', '05005713', '95BF4A82', 'E2B87A14', '7BB12BAE', '0CB61B38', '92D28E9B', 'E5D5BE0D', '7CDCEFB7', '0BDBDF21', '86D3D2D4', 'F1D4E242', '68DDB3F8', '1FDA836E', '81BE16CD', 'F6B9265B', '6FB077E1', '18B74777', '88085AE6', 'FF0F6A70', '66063BCA', '11010B5C', '8F659EFF', 'F862AE69', '616BFFD3', '166CCF45', 'A00AE278', 'D70DD2EE', '4E048354', '3903B3C2', 'A7672661', 'D06016F7', '4969474D', '3E6E77DB', 'AED16A4A', 'D9D65ADC', '40DF0B66', '37D83BF0', 'A9BCAE53', 'DEBB9EC5', '47B2CF7F', '30B5FFE9', 'BDBDF21C', 'CABAC28A', '53B39330', '24B4A3A6', 'BAD03605', 'CDD70693', '54DE5729', '23D967BF', 'B3667A2E', 'C4614AB8', '5D681B02', '2A6F2B94', 'B40BBE37', 'C30C8EA1', '5A05DF1B', '2D02EF8D'].join(' ');
		let crc = 0;
		let x = 0;
		let y = 0;
		crc = crc ^ -1;
		for (let i = 0, iTop = str.length; i < iTop; i++) {
			y = (crc ^ str.charCodeAt(i)) & 0xff;
			x = Number.parseInt('0x' + table.substr(y * 9, 8), 16);
			crc = crc >>> 8 ^ x;
		}
		return crc ^ -1;
	}

	function echo(...args) {
		return console.log(args.join(' '));
	}

	function explode(...args) {
		let [delimiterRaw, stringRaw, limit] = args;
		let delimiter = delimiterRaw;
		const string = stringRaw;
		if (args.length < 2 || typeof delimiter === 'undefined' || typeof string === 'undefined') {
			return null;
		}
		if (delimiter === '' || delimiter === false || delimiter === null) {
			return false;
		}
		if (typeof delimiter === 'function' || typeof delimiter === 'object' || typeof string === 'function' || typeof string === 'object') {
			return {
				'0': ''
			};
		}
		if (delimiter === true) {
			delimiter = '1';
		}
		const normalizedDelimiter = delimiter + '';
		const normalizedString = string + '';
		const s = normalizedString.split(normalizedDelimiter);
		if (typeof limit === 'undefined') {
			return s;
		}
		if (limit === 0) {
			limit = 1;
		}
		if (limit > 0) {
			if (limit >= s.length) {
				return s;
			}
			return s.slice(0, limit - 1).concat([s.slice(limit - 1).join(normalizedDelimiter)]);
		}
		if (-limit >= s.length) {
			return [];
		}
		s.splice(s.length + limit);
		return s;
	}

	function get_html_translation_table(table = 'HTML_SPECIALCHARS', quoteStyle = 'ENT_COMPAT') {
		const entities = {};
		const hashMap = {};
		const constMappingTable = {};
		const constMappingQuoteStyle = {};
		let useTable = '';
		let useQuoteStyle = '';
		constMappingTable[0] = 'HTML_SPECIALCHARS';
		constMappingTable[1] = 'HTML_ENTITIES';
		constMappingQuoteStyle[0] = 'ENT_NOQUOTES';
		constMappingQuoteStyle[2] = 'ENT_COMPAT';
		constMappingQuoteStyle[3] = 'ENT_QUOTES';
		useTable = !isNaN(Number(table)) ? constMappingTable[Number(table)] ?? 'HTML_SPECIALCHARS' : table ? String(table).toUpperCase() : 'HTML_SPECIALCHARS';
		useQuoteStyle = !isNaN(Number(quoteStyle)) ? constMappingQuoteStyle[Number(quoteStyle)] ?? 'ENT_COMPAT' : quoteStyle ? String(quoteStyle).toUpperCase() : 'ENT_COMPAT';
		if (useTable !== 'HTML_SPECIALCHARS' && useTable !== 'HTML_ENTITIES') {
			throw new Error('Table: ' + useTable + ' not supported');
		}
		entities['38'] = '&amp;';
		if (useTable === 'HTML_ENTITIES') {
			entities['160'] = '&nbsp;';
			entities['161'] = '&iexcl;';
			entities['162'] = '&cent;';
			entities['163'] = '&pound;';
			entities['164'] = '&curren;';
			entities['165'] = '&yen;';
			entities['166'] = '&brvbar;';
			entities['167'] = '&sect;';
			entities['168'] = '&uml;';
			entities['169'] = '&copy;';
			entities['170'] = '&ordf;';
			entities['171'] = '&laquo;';
			entities['172'] = '&not;';
			entities['173'] = '&shy;';
			entities['174'] = '&reg;';
			entities['175'] = '&macr;';
			entities['176'] = '&deg;';
			entities['177'] = '&plusmn;';
			entities['178'] = '&sup2;';
			entities['179'] = '&sup3;';
			entities['180'] = '&acute;';
			entities['181'] = '&micro;';
			entities['182'] = '&para;';
			entities['183'] = '&middot;';
			entities['184'] = '&cedil;';
			entities['185'] = '&sup1;';
			entities['186'] = '&ordm;';
			entities['187'] = '&raquo;';
			entities['188'] = '&frac14;';
			entities['189'] = '&frac12;';
			entities['190'] = '&frac34;';
			entities['191'] = '&iquest;';
			entities['192'] = '&Agrave;';
			entities['193'] = '&Aacute;';
			entities['194'] = '&Acirc;';
			entities['195'] = '&Atilde;';
			entities['196'] = '&Auml;';
			entities['197'] = '&Aring;';
			entities['198'] = '&AElig;';
			entities['199'] = '&Ccedil;';
			entities['200'] = '&Egrave;';
			entities['201'] = '&Eacute;';
			entities['202'] = '&Ecirc;';
			entities['203'] = '&Euml;';
			entities['204'] = '&Igrave;';
			entities['205'] = '&Iacute;';
			entities['206'] = '&Icirc;';
			entities['207'] = '&Iuml;';
			entities['208'] = '&ETH;';
			entities['209'] = '&Ntilde;';
			entities['210'] = '&Ograve;';
			entities['211'] = '&Oacute;';
			entities['212'] = '&Ocirc;';
			entities['213'] = '&Otilde;';
			entities['214'] = '&Ouml;';
			entities['215'] = '&times;';
			entities['216'] = '&Oslash;';
			entities['217'] = '&Ugrave;';
			entities['218'] = '&Uacute;';
			entities['219'] = '&Ucirc;';
			entities['220'] = '&Uuml;';
			entities['221'] = '&Yacute;';
			entities['222'] = '&THORN;';
			entities['223'] = '&szlig;';
			entities['224'] = '&agrave;';
			entities['225'] = '&aacute;';
			entities['226'] = '&acirc;';
			entities['227'] = '&atilde;';
			entities['228'] = '&auml;';
			entities['229'] = '&aring;';
			entities['230'] = '&aelig;';
			entities['231'] = '&ccedil;';
			entities['232'] = '&egrave;';
			entities['233'] = '&eacute;';
			entities['234'] = '&ecirc;';
			entities['235'] = '&euml;';
			entities['236'] = '&igrave;';
			entities['237'] = '&iacute;';
			entities['238'] = '&icirc;';
			entities['239'] = '&iuml;';
			entities['240'] = '&eth;';
			entities['241'] = '&ntilde;';
			entities['242'] = '&ograve;';
			entities['243'] = '&oacute;';
			entities['244'] = '&ocirc;';
			entities['245'] = '&otilde;';
			entities['246'] = '&ouml;';
			entities['247'] = '&divide;';
			entities['248'] = '&oslash;';
			entities['249'] = '&ugrave;';
			entities['250'] = '&uacute;';
			entities['251'] = '&ucirc;';
			entities['252'] = '&uuml;';
			entities['253'] = '&yacute;';
			entities['254'] = '&thorn;';
			entities['255'] = '&yuml;';
		}
		if (useQuoteStyle !== 'ENT_NOQUOTES') {
			entities['34'] = '&quot;';
		}
		if (useQuoteStyle === 'ENT_QUOTES') {
			entities['39'] = '&#39;';
		}
		entities['60'] = '&lt;';
		entities['62'] = '&gt;';
		for (const [decimal, entity] of Object.entries(entities)) {
			hashMap[String.fromCharCode(Number(decimal))] = entity ?? '';
		}
		return hashMap;
	}

	function hex2bin(s) {
		const ret = [];
		const input = String(s);
		for (let i = 0; i < input.length; i += 2) {
			const c = Number.parseInt(input.substring(i, i + 1), 16);
			const k = Number.parseInt(input.substring(i + 1, i + 2), 16);
			if (Number.isNaN(c) || Number.isNaN(k)) {
				return false;
			}
			ret.push(c << 4 | k);
		}
		return String.fromCharCode.apply(String, ret);
	}

	function html_entity_decode(string, quoteStyle) {
		let tmpStr = string.toString();
		const hashMapUnknown = get_html_translation_table('HTML_ENTITIES', quoteStyle);
		if (hashMapUnknown === false || !hashMapUnknown || typeof hashMapUnknown !== 'object') {
			return false;
		}
		const normalizedHashMap = {};
		const hashMapObject = toPhpArrayObject(hashMapUnknown);
		for (const [symbol, entity] of Object.entries(hashMapObject)) {
			if (typeof entity === 'string') {
				normalizedHashMap[symbol] = entity;
			}
		}
		delete normalizedHashMap['&'];
		normalizedHashMap['&'] = '&amp;';
		for (const [symbol, entity] of Object.entries(normalizedHashMap)) {
			tmpStr = tmpStr.replaceAll(entity, symbol);
		}
		tmpStr = tmpStr.replaceAll('&#039;', '\'');
		return tmpStr;
	}

	function htmlentities(string, quoteStyle, charset, doubleEncode) {
		const hashMap = get_html_translation_table('HTML_ENTITIES', quoteStyle);
		const source = string === null ? '' : string + '';
		if (quoteStyle && quoteStyle === 'ENT_QUOTES') {
			hashMap['\''] = '&#039;';
		}
		const shouldDoubleEncode = doubleEncode === null || !!doubleEncode;
		const regex = new RegExp('&(?:#\\d+|#x[\\da-f]+|[a-zA-Z][\\da-z]*);|[' + Object.keys(hashMap).join('').replace(/([()[\]{}\-.*+?^$|/\\])/g, '\\$1') + ']', 'g');
		return source.replace(regex, (function(ent) {
			if (ent.length > 1) {
				return shouldDoubleEncode ? hashMap['&'] + ent.substring(1) : ent;
			}
			return hashMap[ent] ?? ent;
		}));
	}

	function htmlspecialchars(string, quoteStyle, charset, doubleEncode) {
		let optTemp = 0;
		let noquotes = false;
		let quoteStyleValue = quoteStyle;
		if (typeof quoteStyleValue === 'undefined' || quoteStyleValue === null) {
			quoteStyleValue = 2;
		}
		let encoded = string || '';
		encoded = encoded.toString();
		if (doubleEncode !== false) {
			encoded = encoded.replace(/&/g, '&amp;');
		}
		encoded = encoded.replace(/</g, '&lt;').replace(/>/g, '&gt;');
		const OPTS = {
			'ENT_NOQUOTES': 0,
			'ENT_HTML_QUOTE_SINGLE': 1,
			'ENT_HTML_QUOTE_DOUBLE': 2,
			'ENT_COMPAT': 2,
			'ENT_QUOTES': 3,
			'ENT_IGNORE': 4
		};
		const isOptKey = value => Object.hasOwn(OPTS, value);
		if (quoteStyleValue === 0) {
			noquotes = true;
		}
		if (typeof quoteStyleValue !== 'number') {
			const quoteStyleFlags = (Array.isArray(quoteStyleValue) ? quoteStyleValue : [quoteStyleValue]).map((flag => String(flag)));
			for (const flag of quoteStyleFlags) {
				if (flag === 'ENT_NOQUOTES') {
					noquotes = true;
				} else if (isOptKey(flag) && OPTS[flag]) {
					optTemp |= OPTS[flag];
				}
			}
			quoteStyleValue = optTemp;
		}
		const resolvedQuoteStyle = typeof quoteStyleValue === 'number' ? quoteStyleValue : optTemp;
		if (resolvedQuoteStyle & OPTS.ENT_HTML_QUOTE_SINGLE) {
			encoded = encoded.replace(/'/g, '&#039;');
		}
		if (!noquotes) {
			encoded = encoded.replace(/"/g, '&quot;');
		}
		return encoded;
	}

	function htmlspecialchars_decode(string, quoteStyle) {
		let optTemp = 0;
		let noquotes = false;
		let quoteStyleValue = quoteStyle;
		if (typeof quoteStyleValue === 'undefined') {
			quoteStyleValue = 2;
		}
		let decoded = string.toString().replace(/&lt;/g, '<').replace(/&gt;/g, '>');
		const OPTS = {
			'ENT_NOQUOTES': 0,
			'ENT_HTML_QUOTE_SINGLE': 1,
			'ENT_HTML_QUOTE_DOUBLE': 2,
			'ENT_COMPAT': 2,
			'ENT_QUOTES': 3,
			'ENT_IGNORE': 4
		};
		const isOptKey = value => Object.hasOwn(OPTS, value);
		if (quoteStyleValue === 0) {
			noquotes = true;
		}
		if (typeof quoteStyleValue !== 'number') {
			const quoteStyleFlags = (Array.isArray(quoteStyleValue) ? quoteStyleValue : [quoteStyleValue]).map((flag => String(flag)));
			for (const flag of quoteStyleFlags) {
				if (flag === 'ENT_NOQUOTES') {
					noquotes = true;
				} else if (isOptKey(flag) && OPTS[flag]) {
					optTemp |= OPTS[flag];
				}
			}
			quoteStyleValue = optTemp;
		}
		const resolvedQuoteStyle = typeof quoteStyleValue === 'number' ? quoteStyleValue : optTemp;
		if (resolvedQuoteStyle & OPTS.ENT_HTML_QUOTE_SINGLE) {
			decoded = decoded.replace(/&#0*39;/g, '\'');
		}
		if (!noquotes) {
			decoded = decoded.replace(/&quot;/g, '"');
		}
		decoded = decoded.replace(/&amp;/g, '&');
		return decoded;
	}

	function implode(...providedArgs) {
		let retVal = '';
		let tGlue = '';
		let actualGlue = '';
		let actualPieces;
		if (providedArgs.length === 1) {
			const [glueOrPieces] = providedArgs;
			actualPieces = glueOrPieces;
		} else {
			const [glueOrPieces, pieces] = providedArgs;
			actualGlue = String(glueOrPieces ?? '');
			actualPieces = pieces;
		}
		if (typeof actualPieces === 'object' && actualPieces !== null) {
			if (Array.isArray(actualPieces)) {
				return actualPieces.join(actualGlue);
			}
			for (const key in actualPieces) {
				retVal += tGlue + actualPieces[key];
				tGlue = actualGlue;
			}
			return retVal;
		}
		return String(actualPieces);
	}

	function lcfirst(str) {
		str += '';
		const f = str.charAt(0).toLowerCase();
		return f + str.substr(1);
	}

	function levenshtein(s1, s2, costIns, costRep, costDel) {
		costIns = costIns == null ? 1 : +costIns;
		costRep = costRep == null ? 1 : +costRep;
		costDel = costDel == null ? 1 : +costDel;
		if (s1 === s2) {
			return 0;
		}
		const l1 = s1.length;
		const l2 = s2.length;
		if (l1 === 0) {
			return l2 * costIns;
		}
		if (l2 === 0) {
			return l1 * costDel;
		}
		const chars1 = s1.split('');
		const chars2 = s2.split('');
		let p1 = new Array(l2 + 1);
		let p2 = new Array(l2 + 1);
		let i1;
		let i2;
		let c0;
		let c1;
		let c2;
		let tmp;
		const at = (arr, idx) => arr[idx] ?? 0;
		for (i2 = 0; i2 <= l2; i2++) {
			p1[i2] = i2 * costIns;
		}
		for (i1 = 0; i1 < l1; i1++) {
			p2[0] = at(p1, 0) + costDel;
			for (i2 = 0; i2 < l2; i2++) {
				c0 = at(p1, i2) + (chars1[i1] === chars2[i2] ? 0 : costRep);
				c1 = at(p1, i2 + 1) + costDel;
				if (c1 < c0) {
					c0 = c1;
				}
				c2 = at(p2, i2) + costIns;
				if (c2 < c0) {
					c0 = c2;
				}
				p2[i2 + 1] = c0;
			}
			tmp = p1;
			p1 = p2;
			p2 = tmp;
		}
		c0 = at(p1, l2);
		return c0;
	}

	function localeconv() {
		const arr = {};
		setlocale('LC_ALL', 0);
		const numeric = getPhpLocaleGroup('LC_NUMERIC', 'LC_NUMERIC');
		if (!numeric) {
			return arr;
		}
		Object.assign(arr, numeric);
		const monetary = getPhpLocaleGroup('LC_MONETARY', 'LC_MONETARY');
		if (!monetary) {
			return arr;
		}
		Object.assign(arr, monetary);
		return arr;
	}

	function ltrim(str, charlist) {
		if (!arguments.length) {
			throw new Error('ltrim() expects at least 1 argument, 0 given');
		}
		charlist = !charlist ? ' \\s\xa0' : (charlist + '').replace(/([[\]().?/*{}+$^:])/g, '$1');
		const re = new RegExp('^[' + charlist + ']+', 'g');
		return strval(str).replace(re, '');
	}

	function md5(str) {
		let xl = 0;
		const _rotateLeft = function(lValue, iShiftBits) {
			return lValue << iShiftBits | lValue >>> 32 - iShiftBits;
		};
		const _addUnsigned = function(lX, lY) {
			const lX8 = lX & 0x80000000;
			const lY8 = lY & 0x80000000;
			const lX4 = lX & 0x40000000;
			const lY4 = lY & 0x40000000;
			const lResult = (lX & 0x3fffffff) + (lY & 0x3fffffff);
			if (lX4 & lY4) {
				return lResult ^ 0x80000000 ^ lX8 ^ lY8;
			}
			if (lX4 | lY4) {
				if (lResult & 0x40000000) {
					return lResult ^ 0xc0000000 ^ lX8 ^ lY8;
				} else {
					return lResult ^ 0x40000000 ^ lX8 ^ lY8;
				}
			} else {
				return lResult ^ lX8 ^ lY8;
			}
		};
		const _F = function(x, y, z) {
			return x & y | ~x & z;
		};
		const _G = function(x, y, z) {
			return x & z | y & ~z;
		};
		const _H = function(x, y, z) {
			return x ^ y ^ z;
		};
		const _I = function(x, y, z) {
			return y ^ (x | ~z);
		};
		const _FF = function(a, b, c, d, x, s, ac) {
			a = _addUnsigned(a, _addUnsigned(_addUnsigned(_F(b, c, d), x), ac));
			return _addUnsigned(_rotateLeft(a, s), b);
		};
		const _GG = function(a, b, c, d, x, s, ac) {
			a = _addUnsigned(a, _addUnsigned(_addUnsigned(_G(b, c, d), x), ac));
			return _addUnsigned(_rotateLeft(a, s), b);
		};
		const _HH = function(a, b, c, d, x, s, ac) {
			a = _addUnsigned(a, _addUnsigned(_addUnsigned(_H(b, c, d), x), ac));
			return _addUnsigned(_rotateLeft(a, s), b);
		};
		const _II = function(a, b, c, d, x, s, ac) {
			a = _addUnsigned(a, _addUnsigned(_addUnsigned(_I(b, c, d), x), ac));
			return _addUnsigned(_rotateLeft(a, s), b);
		};
		const _convertToWordArray = function(value) {
			let lWordCount = 0;
			const lMessageLength = value.length;
			const lNumberOfWordsTemp1 = lMessageLength + 8;
			const lNumberOfWordsTemp2 = (lNumberOfWordsTemp1 - lNumberOfWordsTemp1 % 64) / 64;
			const lNumberOfWords = (lNumberOfWordsTemp2 + 1) * 16;
			const lWordArray = new Array(lNumberOfWords).fill(0);
			let lBytePosition = 0;
			let lByteCount = 0;
			while (lByteCount < lMessageLength) {
				lWordCount = (lByteCount - lByteCount % 4) / 4;
				lBytePosition = lByteCount % 4 * 8;
				lWordArray[lWordCount] = (lWordArray[lWordCount] ?? 0) | value.charCodeAt(lByteCount) << lBytePosition;
				lByteCount++;
			}
			lWordCount = (lByteCount - lByteCount % 4) / 4;
			lBytePosition = lByteCount % 4 * 8;
			lWordArray[lWordCount] = (lWordArray[lWordCount] ?? 0) | 0x80 << lBytePosition;
			lWordArray[lNumberOfWords - 2] = lMessageLength << 3;
			lWordArray[lNumberOfWords - 1] = lMessageLength >>> 29;
			return lWordArray;
		};
		const _wordToHex = function(lValue) {
			let wordToHexValue = '';
			let wordToHexValueTemp = '';
			let lByte = 0;
			for (let lCount = 0; lCount <= 3; lCount++) {
				lByte = lValue >>> lCount * 8 & 255;
				wordToHexValueTemp = '0' + lByte.toString(16);
				wordToHexValue = wordToHexValue + wordToHexValueTemp.substr(wordToHexValueTemp.length - 2, 2);
			}
			return wordToHexValue;
		};
		let x = [];
		let k = 0;
		let AA = 0;
		let BB = 0;
		let CC = 0;
		let DD = 0;
		let a = 0;
		let b = 0;
		let c = 0;
		let d = 0;
		const S11 = 7;
		const S12 = 12;
		const S13 = 17;
		const S14 = 22;
		const S21 = 5;
		const S22 = 9;
		const S23 = 14;
		const S24 = 20;
		const S31 = 4;
		const S32 = 11;
		const S33 = 16;
		const S34 = 23;
		const S41 = 6;
		const S42 = 10;
		const S43 = 15;
		const S44 = 21;
		str = unescape(encodeURIComponent(strval(str)));
		x = _convertToWordArray(str);
		const _X = function(index) {
			return x[index] ?? 0;
		};
		a = 0x67452301;
		b = 0xefcdab89;
		c = 0x98badcfe;
		d = 0x10325476;
		xl = x.length;
		for (k = 0; k < xl; k += 16) {
			AA = a;
			BB = b;
			CC = c;
			DD = d;
			a = _FF(a, b, c, d, _X(k + 0), S11, 0xd76aa478);
			d = _FF(d, a, b, c, _X(k + 1), S12, 0xe8c7b756);
			c = _FF(c, d, a, b, _X(k + 2), S13, 0x242070db);
			b = _FF(b, c, d, a, _X(k + 3), S14, 0xc1bdceee);
			a = _FF(a, b, c, d, _X(k + 4), S11, 0xf57c0faf);
			d = _FF(d, a, b, c, _X(k + 5), S12, 0x4787c62a);
			c = _FF(c, d, a, b, _X(k + 6), S13, 0xa8304613);
			b = _FF(b, c, d, a, _X(k + 7), S14, 0xfd469501);
			a = _FF(a, b, c, d, _X(k + 8), S11, 0x698098d8);
			d = _FF(d, a, b, c, _X(k + 9), S12, 0x8b44f7af);
			c = _FF(c, d, a, b, _X(k + 10), S13, 0xffff5bb1);
			b = _FF(b, c, d, a, _X(k + 11), S14, 0x895cd7be);
			a = _FF(a, b, c, d, _X(k + 12), S11, 0x6b901122);
			d = _FF(d, a, b, c, _X(k + 13), S12, 0xfd987193);
			c = _FF(c, d, a, b, _X(k + 14), S13, 0xa679438e);
			b = _FF(b, c, d, a, _X(k + 15), S14, 0x49b40821);
			a = _GG(a, b, c, d, _X(k + 1), S21, 0xf61e2562);
			d = _GG(d, a, b, c, _X(k + 6), S22, 0xc040b340);
			c = _GG(c, d, a, b, _X(k + 11), S23, 0x265e5a51);
			b = _GG(b, c, d, a, _X(k + 0), S24, 0xe9b6c7aa);
			a = _GG(a, b, c, d, _X(k + 5), S21, 0xd62f105d);
			d = _GG(d, a, b, c, _X(k + 10), S22, 0x2441453);
			c = _GG(c, d, a, b, _X(k + 15), S23, 0xd8a1e681);
			b = _GG(b, c, d, a, _X(k + 4), S24, 0xe7d3fbc8);
			a = _GG(a, b, c, d, _X(k + 9), S21, 0x21e1cde6);
			d = _GG(d, a, b, c, _X(k + 14), S22, 0xc33707d6);
			c = _GG(c, d, a, b, _X(k + 3), S23, 0xf4d50d87);
			b = _GG(b, c, d, a, _X(k + 8), S24, 0x455a14ed);
			a = _GG(a, b, c, d, _X(k + 13), S21, 0xa9e3e905);
			d = _GG(d, a, b, c, _X(k + 2), S22, 0xfcefa3f8);
			c = _GG(c, d, a, b, _X(k + 7), S23, 0x676f02d9);
			b = _GG(b, c, d, a, _X(k + 12), S24, 0x8d2a4c8a);
			a = _HH(a, b, c, d, _X(k + 5), S31, 0xfffa3942);
			d = _HH(d, a, b, c, _X(k + 8), S32, 0x8771f681);
			c = _HH(c, d, a, b, _X(k + 11), S33, 0x6d9d6122);
			b = _HH(b, c, d, a, _X(k + 14), S34, 0xfde5380c);
			a = _HH(a, b, c, d, _X(k + 1), S31, 0xa4beea44);
			d = _HH(d, a, b, c, _X(k + 4), S32, 0x4bdecfa9);
			c = _HH(c, d, a, b, _X(k + 7), S33, 0xf6bb4b60);
			b = _HH(b, c, d, a, _X(k + 10), S34, 0xbebfbc70);
			a = _HH(a, b, c, d, _X(k + 13), S31, 0x289b7ec6);
			d = _HH(d, a, b, c, _X(k + 0), S32, 0xeaa127fa);
			c = _HH(c, d, a, b, _X(k + 3), S33, 0xd4ef3085);
			b = _HH(b, c, d, a, _X(k + 6), S34, 0x4881d05);
			a = _HH(a, b, c, d, _X(k + 9), S31, 0xd9d4d039);
			d = _HH(d, a, b, c, _X(k + 12), S32, 0xe6db99e5);
			c = _HH(c, d, a, b, _X(k + 15), S33, 0x1fa27cf8);
			b = _HH(b, c, d, a, _X(k + 2), S34, 0xc4ac5665);
			a = _II(a, b, c, d, _X(k + 0), S41, 0xf4292244);
			d = _II(d, a, b, c, _X(k + 7), S42, 0x432aff97);
			c = _II(c, d, a, b, _X(k + 14), S43, 0xab9423a7);
			b = _II(b, c, d, a, _X(k + 5), S44, 0xfc93a039);
			a = _II(a, b, c, d, _X(k + 12), S41, 0x655b59c3);
			d = _II(d, a, b, c, _X(k + 3), S42, 0x8f0ccc92);
			c = _II(c, d, a, b, _X(k + 10), S43, 0xffeff47d);
			b = _II(b, c, d, a, _X(k + 1), S44, 0x85845dd1);
			a = _II(a, b, c, d, _X(k + 8), S41, 0x6fa87e4f);
			d = _II(d, a, b, c, _X(k + 15), S42, 0xfe2ce6e0);
			c = _II(c, d, a, b, _X(k + 6), S43, 0xa3014314);
			b = _II(b, c, d, a, _X(k + 13), S44, 0x4e0811a1);
			a = _II(a, b, c, d, _X(k + 4), S41, 0xf7537e82);
			d = _II(d, a, b, c, _X(k + 11), S42, 0xbd3af235);
			c = _II(c, d, a, b, _X(k + 2), S43, 0x2ad7d2bb);
			b = _II(b, c, d, a, _X(k + 9), S44, 0xeb86d391);
			a = _addUnsigned(a, AA);
			b = _addUnsigned(b, BB);
			c = _addUnsigned(c, CC);
			d = _addUnsigned(d, DD);
		}
		const temp = _wordToHex(a) + _wordToHex(b) + _wordToHex(c) + _wordToHex(d);
		return temp.toLowerCase();
	}

	function metaphone(word, maxPhonemes) {
		const type = typeof word;
		if (type === 'undefined' || type === 'object' && word !== null) {
			return null;
		}
		let normalizedWord = typeof word === 'string' ? word : '';
		if (type === 'number') {
			if (Number.isNaN(word)) {
				normalizedWord = 'NAN';
			} else if (!Number.isFinite(word)) {
				normalizedWord = 'INF';
			} else {
				normalizedWord = '';
			}
		}
		const maxPhonemeLimit = Math.floor(Number(maxPhonemes)) || 0;
		if (maxPhonemeLimit < 0) {
			return false;
		}
		const alpha = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
		const vowel = 'AEIOU';
		const soft = 'EIY';
		const leadingNonAlpha = new RegExp('^[^' + alpha + ']+');
		normalizedWord = normalizedWord.toUpperCase().replace(leadingNonAlpha, '');
		if (!normalizedWord) {
			return '';
		}
		const is = function(p, c) {
			return c !== '' && p.includes(c);
		};
		let i = 0;
		let cc = normalizedWord.charAt(0);
		let nc = normalizedWord.charAt(1);
		let nnc = '';
		let pc = '';
		const l = normalizedWord.length;
		let meta = '';
		const traditional = true;
		switch (cc) {
			case 'A':
				meta += nc === 'E' ? nc : cc;
				i += 1;
				break;
			case 'G':
			case 'K':
			case 'P':
				if (nc === 'N') {
					meta += nc;
					i += 2;
				}
				break;
			case 'W':
				if (nc === 'R') {
					meta += nc;
					i += 2;
				} else if (nc === 'H' || is(vowel, nc)) {
					meta += 'W';
					i += 2;
				}
				break;
			case 'X':
				meta += 'S';
				i += 1;
				break;
			case 'E':
			case 'I':
			case 'O':
			case 'U':
				meta += cc;
				i++;
				break;
		}
		for (; i < l && (maxPhonemeLimit === 0 || meta.length < maxPhonemeLimit); i += 1) {
			cc = normalizedWord.charAt(i);
			nc = normalizedWord.charAt(i + 1);
			pc = normalizedWord.charAt(i - 1);
			nnc = normalizedWord.charAt(i + 2);
			if (cc === pc && cc !== 'C') {
				continue;
			}
			switch (cc) {
				case 'B':
					if (pc !== 'M') {
						meta += cc;
					}
					break;
				case 'C':
					if (is(soft, nc)) {
						if (nc === 'I' && nnc === 'A') {
							meta += 'X';
						} else if (pc !== 'S') {
							meta += 'S';
						}
					} else if (nc === 'H') {
						meta += !traditional && (nnc === 'R' || pc === 'S') ? 'K' : 'X';
						i += 1;
					} else {
						meta += 'K';
					}
					break;
				case 'D':
					if (nc === 'G' && is(soft, nnc)) {
						meta += 'J';
						i += 1;
					} else {
						meta += 'T';
					}
					break;
				case 'G':
					if (nc === 'H') {
						if (!(is('BDH', normalizedWord.charAt(i - 3)) || normalizedWord.charAt(i - 4) === 'H')) {
							meta += 'F';
							i += 1;
						}
					} else if (nc === 'N') {
						if (is(alpha, nnc) && normalizedWord.substr(i + 1, 3) !== 'NED') {
							meta += 'K';
						}
					} else if (is(soft, nc) && pc !== 'G') {
						meta += 'J';
					} else {
						meta += 'K';
					}
					break;
				case 'H':
					if (is(vowel, nc) && !is('CGPST', pc)) {
						meta += cc;
					}
					break;
				case 'K':
					if (pc !== 'C') {
						meta += 'K';
					}
					break;
				case 'P':
					meta += nc === 'H' ? 'F' : cc;
					break;
				case 'Q':
					meta += 'K';
					break;
				case 'S':
					if (nc === 'I' && is('AO', nnc)) {
						meta += 'X';
					} else if (nc === 'H') {
						meta += 'X';
						i += 1;
					} else if (!traditional && normalizedWord.substr(i + 1, 3) === 'CHW') {
						meta += 'X';
						i += 2;
					} else {
						meta += 'S';
					}
					break;
				case 'T':
					if (nc === 'I' && is('AO', nnc)) {
						meta += 'X';
					} else if (nc === 'H') {
						meta += '0';
						i += 1;
					} else if (normalizedWord.substr(i + 1, 2) !== 'CH') {
						meta += 'T';
					}
					break;
				case 'V':
					meta += 'F';
					break;
				case 'W':
				case 'Y':
					if (is(vowel, nc)) {
						meta += cc;
					}
					break;
				case 'X':
					meta += 'KS';
					break;
				case 'Z':
					meta += 'S';
					break;
				case 'F':
				case 'J':
				case 'L':
				case 'M':
				case 'N':
				case 'R':
					meta += cc;
					break;
			}
		}
		return meta;
	}

	function nl2br(str, isXhtml) {
		if (typeof str === 'undefined' || str === null) {
			return '';
		}
		const breakTag = isXhtml || typeof isXhtml === 'undefined' ? '<br ' + '/>' : '<br>';
		return strval(str).replace(/(\r\n|\n\r|\r|\n)/g, breakTag + '$1');
	}
	const defaultLocaleTime = {
		'a': ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
		'A': ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
		'b': ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
		'B': ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
		'p': ['AM', 'PM'],
		'c': '%a %d %b %Y %r %Z',
		'x': '%m/%d/%Y',
		'X': '%r',
		'r': '%I:%M:%S %p'
	};
	const isStringArray = (value, key) => {
		const candidate = value[key];
		return Array.isArray(candidate) && candidate.every((item => typeof item === 'string'));
	};
	const isLocaleTime = value => isStringArray(value, 'a') && isStringArray(value, 'A') && isStringArray(value, 'b') && isStringArray(value, 'B') && isStringArray(value, 'p') && typeof value.c === 'string' && typeof value.x === 'string' && typeof value.X === 'string' && typeof value.r === 'string';

	function nl_langinfo(item) {
		setlocale('LC_ALL', 0);
		const toValue = value => typeof value === 'string' || Array.isArray(value) ? value : false;
		const localeFor = category => {
			const localeGroup = getPhpLocaleGroup(category, category);
			return localeGroup || false;
		};
		const lcTimeCandidate = localeFor('LC_TIME');
		const lcTime = lcTimeCandidate && isLocaleTime(lcTimeCandidate) ? lcTimeCandidate : defaultLocaleTime;
		if (item.startsWith('ABDAY_')) {
			const index = Number.parseInt(item.replace(/^ABDAY_/, ''), 10) - 1;
			return lcTime.a[index] ?? false;
		} else if (item.startsWith('DAY_')) {
			const index = Number.parseInt(item.replace(/^DAY_/, ''), 10) - 1;
			return lcTime.A[index] ?? false;
		} else if (item.startsWith('ABMON_')) {
			const index = Number.parseInt(item.replace(/^ABMON_/, ''), 10) - 1;
			return lcTime.b[index] ?? false;
		} else if (item.startsWith('MON_')) {
			const index = Number.parseInt(item.replace(/^MON_/, ''), 10) - 1;
			return lcTime.B[index] ?? false;
		} else {
			switch (item) {
				case 'AM_STR':
					return lcTime.p[0] ?? false;
				case 'PM_STR':
					return lcTime.p[1] ?? false;
				case 'D_T_FMT':
					return lcTime.c;
				case 'D_FMT':
					return lcTime.x;
				case 'T_FMT':
					return lcTime.X;
				case 'T_FMT_AMPM':
					return lcTime.r;
				case 'ERA':
				case 'ERA_YEAR':
				case 'ERA_D_T_FMT':
				case 'ERA_D_FMT':
				case 'ERA_T_FMT':
					return toValue(lcTime[item]);
			}
			const lcMonetary = localeFor('LC_MONETARY');
			if (!lcMonetary) {
				return false;
			}
			let normalizedItem = item;
			if (normalizedItem === 'CRNCYSTR') {
				normalizedItem = 'CURRENCY_SYMBOL';
			}
			switch (normalizedItem) {
				case 'INT_CURR_SYMBOL':
				case 'CURRENCY_SYMBOL':
				case 'MON_DECIMAL_POINT':
				case 'MON_THOUSANDS_SEP':
				case 'POSITIVE_SIGN':
				case 'NEGATIVE_SIGN':
				case 'INT_FRAC_DIGITS':
				case 'FRAC_DIGITS':
				case 'P_CS_PRECEDES':
				case 'P_SEP_BY_SPACE':
				case 'N_CS_PRECEDES':
				case 'N_SEP_BY_SPACE':
				case 'P_SIGN_POSN':
				case 'N_SIGN_POSN':
					return toValue(lcMonetary[normalizedItem.toLowerCase()]);
				case 'MON_GROUPING':
					return toValue(lcMonetary[normalizedItem.toLowerCase()]);
			}
			const lcNumeric = localeFor('LC_NUMERIC');
			if (!lcNumeric) {
				return false;
			}
			switch (item) {
				case 'RADIXCHAR':
				case 'DECIMAL_POINT':
					return toValue(lcNumeric[item.toLowerCase()]);
				case 'THOUSEP':
				case 'THOUSANDS_SEP':
					return toValue(lcNumeric[item.toLowerCase()]);
				case 'GROUPING':
					return toValue(lcNumeric[item.toLowerCase()]);
			}
			const lcMessages = localeFor('LC_MESSAGES');
			if (!lcMessages) {
				return false;
			}
			switch (item) {
				case 'YESEXPR':
				case 'NOEXPR':
				case 'YESSTR':
				case 'NOSTR':
					return toValue(lcMessages[item]);
			}
			const lcCtype = localeFor('LC_CTYPE');
			if (!lcCtype) {
				return false;
			}
			if (item === 'CODESET') {
				return toValue(lcCtype[item]);
			}
			return false;
		}
	}

	function number_format(number, decimals, decPoint, thousandsSep) {
		const numStr = (number + '').replace(/[^0-9+\-Ee.]/g, '');
		const n = !isFinite(+numStr) ? 0 : +numStr;
		const prec = !isFinite(+(decimals || 0)) ? 0 : Math.abs(decimals || 0);
		const sep = typeof thousandsSep === 'undefined' ? ',' : thousandsSep;
		const dec = typeof decPoint === 'undefined' ? '.' : decPoint;
		let s;
		const toFixedFix = function(n, prec) {
			if (!('' + n).includes('e')) {
				return +(Math.round(+(n + 'e+' + prec)) + 'e-' + prec);
			} else {
				const arr = ('' + n).split('e');
				const mantissa = arr[0] ?? '0';
				const exponent = Number(arr[1] ?? 0);
				let sig = '';
				if (exponent + prec > 0) {
					sig = '+';
				}
				return (+(Math.round(+(+mantissa + 'e' + sig + (exponent + prec))) + 'e-' + prec)).toFixed(prec);
			}
		};
		s = (prec ? toFixedFix(n, prec).toString() : '' + Math.round(n)).split('.');
		const whole = s[0] ?? '';
		if (whole.length > 3) {
			s[0] = whole.replace(/\B(?=(?:\d{3})+(?!\d))/g, sep);
		}
		if ((s[1] || '').length < prec) {
			s[1] = s[1] || '';
			s[1] += new Array(prec - s[1].length + 1).join('0');
		}
		return s.join(dec);
	}

	function ord(string) {
		const str = string + '';
		const code = str.charCodeAt(0);
		if (code >= 0xd800 && code <= 0xdbff) {
			const hi = code;
			if (str.length === 1) {
				return code;
			}
			const low = str.charCodeAt(1);
			return (hi - 0xd800) * 0x400 + (low - 0xdc00) + 0x10000;
		}
		if (code >= 0xdc00 && code <= 0xdfff) {
			return code;
		}
		return code;
	}
	const DANGEROUS_PARSE_STR_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

	function isDangerousParseStrKey(key) {
		return DANGEROUS_PARSE_STR_KEYS.has(key);
	}

	function parse_str(str, array) {
		const strArr = String(str).replace(/^&/, '').replace(/&$/, '').split('&');
		const sal = strArr.length;
		let i = 0;
		let j = 0;
		let ct = 0;
		let lastObj = {};
		let obj = {};
		let chr;
		let tmp = [];
		let key = '';
		let value = '';
		let postLeftBracketPos = 0;
		let keys = [];
		let keysLen = 0;
		const _fixStr = function(str) {
			return decodeURIComponent(str.replace(/\+/g, '%20'));
		};
		const target = array || getPhpGlobalScope();
		for (i = 0; i < sal; i++) {
			tmp = (strArr[i] ?? '').split('=');
			key = _fixStr(tmp[0] ?? '');
			value = tmp.length < 2 ? '' : _fixStr(tmp[1] ?? '');
			while (key.charAt(0) === ' ') {
				key = key.slice(1);
			}
			const nullByteIndex = key.indexOf('\0');
			if (nullByteIndex > -1) {
				key = key.slice(0, nullByteIndex);
			}
			if (key && key.charAt(0) !== '[') {
				keys = [];
				postLeftBracketPos = 0;
				for (j = 0; j < key.length; j++) {
					if (key.charAt(j) === '[' && !postLeftBracketPos) {
						postLeftBracketPos = j + 1;
					} else if (key.charAt(j) === ']') {
						if (postLeftBracketPos) {
							if (!keys.length) {
								keys.push(key.slice(0, postLeftBracketPos - 1));
							}
							keys.push(key.substr(postLeftBracketPos, j - postLeftBracketPos));
							postLeftBracketPos = 0;
							if (key.charAt(j + 1) !== '[') {
								break;
							}
						}
					}
				}
				if (!keys.length) {
					keys = [key];
				}
				let primaryKey = keys[0] ?? '';
				for (j = 0; j < primaryKey.length; j++) {
					chr = primaryKey.charAt(j);
					if (chr === ' ' || chr === '.' || chr === '[') {
						primaryKey = primaryKey.substring(0, j) + '_' + primaryKey.substring(j + 1);
					}
					if (chr === '[') {
						break;
					}
				}
				keys[0] = primaryKey;
				let hasDangerousKey = false;
				for (const rawKey of keys) {
					const normalizedKey = rawKey.replace(/^['"]/, '').replace(/['"]$/, '');
					if (isDangerousParseStrKey(normalizedKey)) {
						hasDangerousKey = true;
						break;
					}
				}
				if (hasDangerousKey) {
					continue;
				}
				obj = target;
				let skipAssignment = false;
				for (j = 0, keysLen = keys.length; j < keysLen; j++) {
					key = (keys[j] ?? '').replace(/^['"]/, '').replace(/['"]$/, '');
					lastObj = obj;
					if ((key === '' || key === ' ') && j !== 0) {
						ct = -1;
						for (const objKey of Object.keys(obj)) {
							if (+objKey > ct && /^\d+$/.test(objKey)) {
								ct = +objKey;
							}
						}
						key = String(ct + 1);
					}
					if (isDangerousParseStrKey(key)) {
						skipAssignment = true;
						break;
					}
					const current = obj[key];
					if (!isPhpAssocObject(current)) {
						obj[key] = {};
					}
					const next = obj[key];
					if (!isPhpAssocObject(next)) {
						break;
					}
					obj = next;
				}
				if (skipAssignment || isDangerousParseStrKey(key)) {
					continue;
				}
				lastObj[key] = value;
			}
		}
	}

	function printf(format, ...args) {
		const ret = sprintf(format, ...args);
		if (ret === false) {
			return 0;
		}
		echo(ret);
		return ret.length;
	}

	function quoted_printable_decode(str) {
		const RFC2045Decode1 = /=\r\n/gm;
		const RFC2045Decode2IN = /=([0-9A-F]{2})/gim;
		const RFC2045Decode2OUT = function(_sMatch, sHex) {
			return String.fromCharCode(parseInt(sHex, 16));
		};
		return str.replace(RFC2045Decode1, '').replace(RFC2045Decode2IN, RFC2045Decode2OUT);
	}

	function quoted_printable_encode(str) {
		const hexChars = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'A', 'B', 'C', 'D', 'E', 'F'];
		const RFC2045Encode1IN = / \r\n|\r\n|[^!-<>-~ ]/gm;
		const RFC2045Encode1OUT = function(sMatch) {
			if (sMatch.length > 1) {
				return sMatch.replace(' ', '=20');
			}
			const chr = sMatch.charCodeAt(0);
			return '=' + hexChars[chr >>> 4 & 15] + hexChars[chr & 15];
		};
		const RFC2045Encode2IN = /.{1,72}(?!\r\n)[^=]{0,3}/g;
		const RFC2045Encode2OUT = function(sMatch) {
			if (sMatch.endsWith('\r\n')) {
				return sMatch;
			}
			return sMatch + '=\r\n';
		};
		str = str.replace(RFC2045Encode1IN, RFC2045Encode1OUT).replace(RFC2045Encode2IN, RFC2045Encode2OUT);
		if (str.endsWith('=\r\n')) {
			return str.slice(0, -3);
		}
		return str;
	}

	function quotemeta(str) {
		return strval(str).replace(/([.\\+*?[^\]$()])/g, '\\$1');
	}

	function rtrim(str, charlist) {
		if (!arguments.length) {
			throw new Error('rtrim() expects at least 1 argument, 0 given');
		}
		charlist = !charlist ? ' \\s\xa0' : (charlist + '').replace(/([[\]().?/*{}+$^:])/g, '\\$1');
		const re = new RegExp('[' + charlist + ']+$', 'g');
		return strval(str).replace(re, '');
	}
	const isLocaleDefinitionMap = value => typeof value === 'object' && value !== null && !Array.isArray(value);
	const isLocaleCategoryMap = value => isPhpAssocObject(value) && typeof value.LC_COLLATE === 'string' && typeof value.LC_CTYPE === 'string' && typeof value.LC_MONETARY === 'string' && typeof value.LC_NUMERIC === 'string' && typeof value.LC_TIME === 'string' && typeof value.LC_MESSAGES === 'string';

	function copyValue(orig) {
		if (orig instanceof RegExp) {
			return new RegExp(orig);
		}
		if (orig instanceof Date) {
			return new Date(orig);
		}
		if (Array.isArray(orig)) {
			return orig.map((item => copyValue(item)));
		}
		if (orig !== null && typeof orig === 'object') {
			const newObj = {};
			for (const [key, value] of Object.entries(orig)) {
				newObj[key] = value !== null && typeof value === 'object' ? copyValue(value) : value;
			}
			return newObj;
		}
		return orig;
	}

	function setlocale(category, locale) {
		const cats = [];
		let i = 0;
		const _nplurals2a = function(n) {
			return n !== 1 ? 1 : 0;
		};
		const _nplurals2b = function(n) {
			return n > 1 ? 1 : 0;
		};
		const localesValue = getPhpRuntimeEntry('locales');
		let locales = isLocaleDefinitionMap(localesValue) ? localesValue : {};
		if (localesValue !== locales) {
			setPhpRuntimeEntry('locales', locales);
		}
		if (!locales.fr_CA?.LC_TIME?.x) {
			locales = {};
			setPhpRuntimeEntry('locales', locales);
			locales.en = {
				'LC_COLLATE': function(str1, str2) {
					return str1 === str2 ? 0 : str1 > str2 ? 1 : -1;
				},
				'LC_CTYPE': {
					'an': /^[A-Za-z\d]+$/g,
					'al': /^[A-Za-z]+$/g,
					'ct': /^[\u0000-\u001F\u007F]+$/g,
					'dg': /^[\d]+$/g,
					'gr': /^[\u0021-\u007E]+$/g,
					'lw': /^[a-z]+$/g,
					'pr': /^[\u0020-\u007E]+$/g,
					'pu': /^[\u0021-\u002F\u003A-\u0040\u005B-\u0060\u007B-\u007E]+$/g,
					'sp': /^[\f\n\r\t\v ]+$/g,
					'up': /^[A-Z]+$/g,
					'xd': /^[A-Fa-f\d]+$/g,
					'CODESET': 'UTF-8',
					'lower': 'abcdefghijklmnopqrstuvwxyz',
					'upper': 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
				},
				'LC_TIME': {
					'a': ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
					'A': ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
					'b': ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
					'B': ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
					'c': '%a %d %b %Y %r %Z',
					'p': ['AM', 'PM'],
					'P': ['am', 'pm'],
					'r': '%I:%M:%S %p',
					'x': '%m/%d/%Y',
					'X': '%r',
					'alt_digits': '',
					'ERA': '',
					'ERA_YEAR': '',
					'ERA_D_T_FMT': '',
					'ERA_D_FMT': '',
					'ERA_T_FMT': ''
				},
				'LC_MONETARY': {
					'int_curr_symbol': 'USD',
					'currency_symbol': '$',
					'mon_decimal_point': '.',
					'mon_thousands_sep': ',',
					'mon_grouping': [3],
					'positive_sign': '',
					'negative_sign': '-',
					'int_frac_digits': 2,
					'frac_digits': 2,
					'p_cs_precedes': 1,
					'p_sep_by_space': 0,
					'n_cs_precedes': 1,
					'n_sep_by_space': 0,
					'p_sign_posn': 3,
					'n_sign_posn': 0
				},
				'LC_NUMERIC': {
					'decimal_point': '.',
					'thousands_sep': ',',
					'grouping': [3]
				},
				'LC_MESSAGES': {
					'YESEXPR': '^[yY].*',
					'NOEXPR': '^[nN].*',
					'YESSTR': '',
					'NOSTR': ''
				},
				'nplurals': _nplurals2a
			};
			locales.en_US = copyValue(locales.en);
			locales.en_US.LC_TIME.c = '%a %d %b %Y %r %Z';
			locales.en_US.LC_TIME.x = '%D';
			locales.en_US.LC_TIME.X = '%r';
			locales.en_US.LC_MONETARY.int_curr_symbol = 'USD ';
			locales.en_US.LC_MONETARY.p_sign_posn = 1;
			locales.en_US.LC_MONETARY.n_sign_posn = 1;
			locales.en_US.LC_MONETARY.mon_grouping = [3, 3];
			locales.en_US.LC_NUMERIC.thousands_sep = '';
			locales.en_US.LC_NUMERIC.grouping = [];
			locales.en_GB = copyValue(locales.en);
			locales.en_GB.LC_TIME.r = '%l:%M:%S %P %Z';
			locales.en_AU = copyValue(locales.en_GB);
			locales.C = copyValue(locales.en);
			locales.C.LC_CTYPE.CODESET = 'ANSI_X3.4-1968';
			locales.C.LC_MONETARY = {
				'int_curr_symbol': '',
				'currency_symbol': '',
				'mon_decimal_point': '',
				'mon_thousands_sep': '',
				'mon_grouping': [],
				'p_cs_precedes': 127,
				'p_sep_by_space': 127,
				'n_cs_precedes': 127,
				'n_sep_by_space': 127,
				'p_sign_posn': 127,
				'n_sign_posn': 127,
				'positive_sign': '',
				'negative_sign': '',
				'int_frac_digits': 127,
				'frac_digits': 127
			};
			locales.C.LC_NUMERIC = {
				'decimal_point': '.',
				'thousands_sep': '',
				'grouping': []
			};
			locales.C.LC_TIME.c = '%a %b %e %H:%M:%S %Y';
			locales.C.LC_TIME.x = '%m/%d/%y';
			locales.C.LC_TIME.X = '%H:%M:%S';
			locales.C.LC_MESSAGES.YESEXPR = '^[yY]';
			locales.C.LC_MESSAGES.NOEXPR = '^[nN]';
			locales.fr = copyValue(locales.en);
			locales.fr.nplurals = _nplurals2b;
			locales.fr.LC_TIME.a = ['dim', 'lun', 'mar', 'mer', 'jeu', 'ven', 'sam'];
			locales.fr.LC_TIME.A = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
			locales.fr.LC_TIME.b = ['jan', 'f\xe9v', 'mar', 'avr', 'mai', 'jun', 'jui', 'ao\xfb', 'sep', 'oct', 'nov', 'd\xe9c'];
			locales.fr.LC_TIME.B = ['janvier', 'f\xe9vrier', 'mars', 'avril', 'mai', 'juin', 'juillet', 'ao\xfbt', 'septembre', 'octobre', 'novembre', 'd\xe9cembre'];
			locales.fr.LC_TIME.c = '%a %d %b %Y %T %Z';
			locales.fr.LC_TIME.p = ['', ''];
			locales.fr.LC_TIME.P = ['', ''];
			locales.fr.LC_TIME.x = '%d.%m.%Y';
			locales.fr.LC_TIME.X = '%T';
			locales.fr_CA = copyValue(locales.fr);
			locales.fr_CA.LC_TIME.x = '%Y-%m-%d';
		}
		let currentLocale = getPhpRuntimeString('locale', '');
		if (!currentLocale) {
			currentLocale = 'en_US';
			if (typeof window !== 'undefined' && window.document) {
				const d = window.document;
				const NS_XHTML = 'https://www.w3.org/1999/xhtml';
				const NS_XML = 'https://www.w3.org/XML/1998/namespace';
				const htmlNsElement = d.getElementsByTagNameNS ? d.getElementsByTagNameNS(NS_XHTML, 'html')[0] : undefined;
				if (htmlNsElement) {
					const xmlLang = htmlNsElement.getAttributeNS(NS_XML, 'lang');
					if (xmlLang) {
						currentLocale = xmlLang;
					} else {
						const htmlLang = htmlNsElement.getAttribute('lang');
						if (htmlLang) {
							currentLocale = htmlLang;
						}
					}
				} else {
					const htmlElement = d.getElementsByTagName('html')[0];
					const htmlLang = htmlElement?.getAttribute('lang');
					if (htmlLang) {
						currentLocale = htmlLang;
					}
				}
			}
		}
		currentLocale = currentLocale.replace('-', '_');
		if (!(currentLocale in locales)) {
			const languageLocale = currentLocale.replace(/_[a-zA-Z]+$/, '');
			if (languageLocale in locales) {
				currentLocale = languageLocale;
			}
			locales[currentLocale] = copyValue(locales.en);
		}
		setPhpRuntimeEntry('locale', currentLocale);
		setPhpRuntimeEntry('locale_default', currentLocale);
		const localeCategoriesValue = getPhpRuntimeEntry('localeCategories');
		const localeCategories = isLocaleCategoryMap(localeCategoriesValue) ? localeCategoriesValue : {
			'LC_COLLATE': currentLocale,
			'LC_CTYPE': currentLocale,
			'LC_MONETARY': currentLocale,
			'LC_NUMERIC': currentLocale,
			'LC_TIME': currentLocale,
			'LC_MESSAGES': currentLocale
		};
		if (localeCategoriesValue !== localeCategories) {
			setPhpRuntimeEntry('localeCategories', localeCategories);
		}
		let requestedLocale = locale;
		if (requestedLocale === null || requestedLocale === '') {
			requestedLocale = getenv(category) || getenv('LANG');
		} else if (Array.isArray(requestedLocale)) {
			for (i = 0; i < requestedLocale.length; i++) {
				const candidate = requestedLocale[i];
				if (typeof candidate !== 'string') {
					if (i === requestedLocale.length - 1) {
						return false;
					}
					continue;
				}
				if (!(candidate in locales)) {
					if (i === requestedLocale.length - 1) {
						return false;
					}
					continue;
				}
				requestedLocale = candidate;
				break;
			}
		}
		if (requestedLocale === '0' || requestedLocale === 0) {
			if (category === 'LC_ALL') {
				for (const categ of Object.keys(localeCategories)) {
					cats.push(categ + '=' + localeCategories[categ]);
				}
				return cats.join(';');
			}
			return localeCategories[category] ?? false;
		}
		if (typeof requestedLocale !== 'string' || !(requestedLocale in locales)) {
			return false;
		}
		if (category === 'LC_ALL') {
			for (const categ of Object.keys(localeCategories)) {
				localeCategories[categ] = requestedLocale;
			}
		} else {
			localeCategories[category] = requestedLocale;
		}
		return requestedLocale;
	}

	function similar_text(first, second, percent) {
		if (first === null || second === null || typeof first === 'undefined' || typeof second === 'undefined') {
			return 0;
		}
		const firstValue = String(first);
		const secondValue = String(second);
		let pos1 = 0;
		let pos2 = 0;
		let max = 0;
		const firstLength = firstValue.length;
		const secondLength = secondValue.length;
		let sum = 0;
		for (let p = 0; p < firstLength; p++) {
			for (let q = 0; q < secondLength; q++) {
				let l = 0;
				for (l = 0; p + l < firstLength && q + l < secondLength && firstValue.charAt(p + l) === secondValue.charAt(q + l); l++) {}
				if (l > max) {
					max = l;
					pos1 = p;
					pos2 = q;
				}
			}
		}
		sum = max;
		if (sum) {
			if (pos1 && pos2) {
				sum += similar_text(firstValue.substr(0, pos1), secondValue.substr(0, pos2));
			}
			if (pos1 + max < firstLength && pos2 + max < secondLength) {
				sum += similar_text(firstValue.substr(pos1 + max, firstLength - pos1 - max), secondValue.substr(pos2 + max, secondLength - pos2 - max));
			}
		}
		if (!percent) {
			return sum;
		}
		return sum * 200 / (firstLength + secondLength);
	}

	function soundex(str) {
		const input = String(str).toUpperCase();
		if (!input) {
			return '';
		}
		const sdx = [0, 0, 0, 0];
		const m = {
			'B': 1,
			'F': 1,
			'P': 1,
			'V': 1,
			'C': 2,
			'G': 2,
			'J': 2,
			'K': 2,
			'Q': 2,
			'S': 2,
			'X': 2,
			'Z': 2,
			'D': 3,
			'T': 3,
			'L': 4,
			'M': 5,
			'N': 5,
			'R': 6
		};
		let i = 0;
		let s = 0;
		let p = 0;
		let c = input.charAt(i++);
		while (c && s < 4) {
			const j = m[c];
			if (j) {
				if (j !== p) {
					sdx[s++] = p = j;
				}
			} else {
				s += Number(i === 1);
				p = 0;
			}
			c = input.charAt(i++);
		}
		sdx[0] = input.charAt(0);
		return sdx.join('');
	}

	function sprintf(format, ...args) {
		const regex = /%%|%(?:(\d+)\$)?((?:[-+#0 ]|'[\s\S])*)(\d+)?(?:\.(\d*))?([\s\S])/g;
		const callArgs = [format, ...args];
		let i = 1;
		const _pad = function(str, len, chr, leftJustify) {
			if (!chr) {
				chr = ' ';
			}
			const padding = str.length >= len ? '' : new Array(1 + len - str.length >>> 0).join(chr);
			return leftJustify ? str + padding : padding + str;
		};
		const justify = function(value, prefix, leftJustify, minWidth, padChar) {
			const diff = minWidth - value.length;
			if (diff > 0) {
				if (!leftJustify && padChar === '0') {
					value = [value.slice(0, prefix.length), _pad('', diff, '0', true), value.slice(prefix.length)].join('');
				} else {
					value = _pad(value, minWidth, padChar, leftJustify);
				}
			}
			return value;
		};
		const _formatBaseX = function(value, base, leftJustify, minWidth, precision, padChar) {
			const number = Number(value) >>> 0;
			const padded = _pad(number.toString(base), precision || 0, '0', false);
			return justify(padded, '', leftJustify, minWidth, padChar);
		};
		const _formatString = function(value, leftJustify, minWidth, precision, customPadChar) {
			if (precision !== null && precision !== undefined) {
				value = value.slice(0, precision);
			}
			return justify(value, '', leftJustify, minWidth, customPadChar);
		};
		const doFormat = function(substring, argIndex, modifiers, minWidthRaw, precisionRaw, specifier) {
			let number = 0;
			let prefix = '';
			let value;
			if (substring === '%%') {
				return '%';
			}
			let padChar = ' ';
			let leftJustify = false;
			let positiveNumberPrefix = '';
			let j = 0;
			let l = 0;
			for (j = 0, l = modifiers.length; j < l; j++) {
				switch (modifiers.charAt(j)) {
					case ' ':
					case '0':
						padChar = modifiers.charAt(j);
						break;
					case '+':
						positiveNumberPrefix = '+';
						break;
					case '-':
						leftJustify = true;
						break;
					case '\'':
						if (j + 1 < l) {
							padChar = modifiers.charAt(j + 1);
							j++;
						}
						break;
				}
			}
			let minWidthNum = 0;
			if (!minWidthRaw) {
				minWidthNum = 0;
			} else {
				minWidthNum = +minWidthRaw;
			}
			if (!isFinite(minWidthNum)) {
				throw new Error('Width must be finite');
			}
			let precisionNum;
			if (!precisionRaw) {
				precisionNum = specifier === 'd' ? 0 : 'fFeE'.includes(specifier) ? 6 : undefined;
			} else {
				precisionNum = +precisionRaw;
			}
			if (argIndex && +argIndex === 0) {
				throw new Error('Argument number must be greater than zero');
			}
			if (argIndex && +argIndex >= callArgs.length) {
				throw new Error('Too few arguments');
			}
			value = argIndex ? callArgs[+argIndex] : callArgs[i++];
			switch (specifier) {
				case '%':
					return '%';
				case 's':
					return _formatString(String(value), leftJustify, minWidthNum, precisionNum, padChar);
				case 'c':
					return _formatString(String.fromCharCode(+String(value)), leftJustify, minWidthNum, precisionNum, padChar);
				case 'b':
					return _formatBaseX(value, 2, leftJustify, minWidthNum, precisionNum, padChar);
				case 'o':
					return _formatBaseX(value, 8, leftJustify, minWidthNum, precisionNum, padChar);
				case 'x':
					return _formatBaseX(value, 16, leftJustify, minWidthNum, precisionNum, padChar);
				case 'X':
					return _formatBaseX(value, 16, leftJustify, minWidthNum, precisionNum, padChar).toUpperCase();
				case 'u':
					return _formatBaseX(value, 10, leftJustify, minWidthNum, precisionNum, padChar);
				case 'i':
				case 'd':
					number = +String(value) || 0;
					number = Math.round(number - number % 1);
					prefix = number < 0 ? '-' : positiveNumberPrefix;
					value = prefix + _pad(String(Math.abs(number)), precisionNum ?? 0, '0', false);
					if (leftJustify && padChar === '0') {
						padChar = ' ';
					}
					return justify(String(value), prefix, leftJustify, minWidthNum, padChar);
				case 'e':
				case 'E':
				case 'f':
				case 'F':
				case 'g':
				case 'G': {
					number = +String(value);
					prefix = number < 0 ? '-' : positiveNumberPrefix;
					const methodIndex = 'efg'.indexOf(specifier.toLowerCase());
					const absNumber = Math.abs(number);
					let floatResult = '';
					if (methodIndex === 0) {
						floatResult = absNumber.toExponential(precisionNum);
					} else if (methodIndex === 1) {
						floatResult = absNumber.toFixed(precisionNum);
					} else {
						floatResult = absNumber.toPrecision(precisionNum);
					}
					const justified = justify(prefix + floatResult, prefix, leftJustify, minWidthNum, padChar);
					return 'eEfFgG'.indexOf(specifier) % 2 === 0 ? justified : justified.toUpperCase();
				}
				default:
					return '';
			}
		};
		try {
			return format.replace(regex, doFormat);
		} catch (_err) {
			return false;
		}
	}

	function sscanf(str, format, ...refs) {
		const retArr = [];
		const _NWS = /\S/;
		let digit;
		let input = str;
		const _setExtraConversionSpecs = function(offset) {
			const matches = format.slice(offset).match(/%[cdeEufgosxX]/g);
			if (matches) {
				let lgth = matches.length;
				while (lgth--) {
					retArr.push(null);
				}
			}
			return _finish();
		};
		const _finish = function() {
			if (refs.length === 0) {
				return retArr;
			}
			let i = 0;
			for (; i < retArr.length; ++i) {
				const ref = refs[i];
				if (!ref) {
					break;
				}
				ref.value = retArr[i] ?? null;
			}
			return i;
		};
		const _addNext = function(j, regex, cb) {
			if (assign) {
				const remaining = input.slice(j);
				const check = width ? remaining.slice(0, width) : remaining;
				const match = regex.exec(check);
				const key = digit !== undefined ? digit : retArr.length;
				const nextValue = match ? cb ? cb(...match) : match[0] ?? null : null;
				retArr[key] = nextValue;
				if (nextValue === null) {
					throw new Error('No match in string');
				}
				return j + (match?.[0]?.length ?? 0);
			}
			return j;
		};
		if (str === undefined || format === undefined) {
			throw new Error('Not enough arguments passed to sscanf');
		}
		let width = 0;
		let assign = true;
		for (let i = 0, j = 0; i < format.length; i++) {
			width = 0;
			assign = true;
			if (format.charAt(i) === '%') {
				if (format.charAt(i + 1) === '%') {
					if (input.charAt(j) === '%') {
						++i;
						++j;
						continue;
					}
					return _setExtraConversionSpecs(i + 2);
				}
				const prePattern = /^(?:(\d+)\$)?(\*)?(\d*)([hlL]?)/g;
				const preConvs = prePattern.exec(format.slice(i + 1));
				if (!preConvs) {
					throw new Error('Unexpected format in sscanf()');
				}
				const tmpDigit = digit;
				if (tmpDigit && preConvs[1] === undefined) {
					let msg = 'All groups in sscanf() must be expressed as numeric if ';
					msg += 'any have already been used';
					throw new Error(msg);
				}
				digit = preConvs[1] ? parseInt(preConvs[1], 10) - 1 : undefined;
				assign = !preConvs[2];
				width = parseInt(preConvs[3] ?? '', 10);
				const sizeCode = preConvs[4];
				i += prePattern.lastIndex;
				if (sizeCode) {
					switch (sizeCode) {
						case 'h':
						case 'l':
						case 'L':
							break;
						default:
							throw new Error('Unexpected size specifier in sscanf()!');
					}
				}
				try {
					switch (format.charAt(i + 1)) {
						case 'F':
							break;
						case 'g':
							break;
						case 'G':
							break;
						case 'b':
							break;
						case 'i': {
							const pattern = /([+-])?(?:(?:0x([\da-fA-F]+))|(?:0([0-7]+))|(\d+))/;
							j = _addNext(j, pattern, (function(num, _sign, hex, oct) {
								return hex ? parseInt(num, 16) : oct ? parseInt(num, 8) : parseInt(num, 10);
							}));
							break;
						}
						case 'n':
							retArr[digit !== undefined ? digit : retArr.length - 1] = j;
							break;
						case 'c':
							j = _addNext(j, new RegExp('.{1,' + (width || 1) + '}'));
							break;
						case 'D':
						case 'd':
							j = _addNext(j, /([+-])?(?:0*)(\d+)/, (function(_num, sign, dec) {
								const decInt = parseInt((sign || '') + dec, 10);
								if (decInt < 0) {
									return decInt < -2147483648 ? -2147483648 : decInt;
								} else {
									return decInt < 2147483647 ? decInt : 2147483647;
								}
							}));
							break;
						case 'f':
						case 'E':
						case 'e':
							j = _addNext(j, /([+-])?(?:0*)(\d*\.?\d*(?:[eE]?\d+)?)/, (function(_num, sign, dec) {
								if (dec === '.') {
									return null;
								}
								return parseFloat((sign || '') + dec);
							}));
							break;
						case 'u':
							j = _addNext(j, /([+-])?(?:0*)(\d+)/, (function(_num, sign, dec) {
								const decInt = parseInt(dec, 10);
								if (sign === '-') {
									return 4294967296 - decInt;
								} else {
									return decInt < 4294967295 ? decInt : 4294967295;
								}
							}));
							break;
						case 'o':
							j = _addNext(j, /([+-])?(?:0([0-7]+))/, (function(num) {
								return parseInt(num, 8);
							}));
							break;
						case 's':
							j = _addNext(j, /\S+/);
							break;
						case 'X':
						case 'x':
							j = _addNext(j, /([+-])?(?:(?:0x)?([\da-fA-F]+))/, (function(num) {
								return parseInt(num, 16);
							}));
							break;
						case '':
							throw new Error('Missing character after percent mark in sscanf() format argument');
						default:
							throw new Error('Unrecognized character after percent mark in sscanf() format argument');
					}
				} catch (e) {
					if (e === 'No match in string') {
						return _setExtraConversionSpecs(i + 2);
					}
				}
				++i;
			} else if (format.charAt(i) !== input.charAt(j)) {
				_NWS.lastIndex = 0;
				if (_NWS.test(input.charAt(j)) || input.charAt(j) === '') {
					return _setExtraConversionSpecs(i + 1);
				} else {
					input = input.slice(0, j) + input.slice(j + 1);
					i--;
				}
			} else {
				j++;
			}
		}
		return _finish();
	}

	function str_getcsv(input, delimiter, enclosure, escapeCharacter) {
		let i = 0;
		let inpLen = 0;
		const output = [];
		const _backwards = function(str) {
			return str.split('').reverse().join('');
		};
		const _pq = function(str) {
			return String(str).replace(/([\\.+*?[^\]$(){}=!<>|:])/g, '\\$1');
		};
		const delimiterValue = delimiter || ',';
		const enclosureValue = enclosure || '"';
		const escapeValue = escapeCharacter || '\\';
		const pqEnc = _pq(enclosureValue);
		const pqEsc = _pq(escapeValue);
		const trimmedInput = input.replace(new RegExp('^\\s*' + pqEnc), '').replace(new RegExp(pqEnc + '\\s*$'), '');
		const entries = _backwards(trimmedInput).split(new RegExp(pqEnc + '\\s*' + _pq(delimiterValue) + '\\s*' + pqEnc + '(?!' + pqEsc + ')', 'g')).reverse();
		for (i = 0, inpLen = entries.length; i < inpLen; i++) {
			output.push(_backwards(entries[i] ?? '').replace(new RegExp(pqEsc + pqEnc, 'g'), enclosureValue));
		}
		return output;
	}
	const asArray = value => Array.isArray(value) ? [...value] : [value];

	function str_ireplace(search, replace, subject, countObj) {
		const loweredSearch = Array.isArray(search) ? search.map((item => item.toLowerCase())) : search.toLowerCase();
		const loweredSubject = Array.isArray(subject) ? subject.map((item => item.toLowerCase())) : subject.toLowerCase();
		const osa = Array.isArray(subject);
		const f = asArray(loweredSearch);
		const s = asArray(loweredSubject);
		const os = asArray(subject);
		let r = asArray(replace);
		if (Array.isArray(loweredSearch) && typeof replace === 'string') {
			r = loweredSearch.map((() => replace));
		}
		if (countObj) {
			countObj.value = 0;
		}
		for (let i = 0, sl = s.length; i < sl; i++) {
			if (s[i] === '') {
				continue;
			}
			for (let j = 0, fl = f.length; j < fl; j++) {
				const searchTerm = f[j] ?? '';
				if (searchTerm === '') {
					continue;
				}
				const temp = s[i] ?? '';
				const repl = r[j] ?? '';
				s[i] = temp.replaceAll(searchTerm, repl);
				const otemp = os[i] ?? '';
				const oi = temp.indexOf(searchTerm);
				const ofjl = searchTerm.length;
				if (oi >= 0) {
					os[i] = otemp.replaceAll(otemp.substr(oi, ofjl), repl);
				}
				if (countObj) {
					countObj.value = (countObj.value ?? 0) + temp.split(searchTerm).length - 1;
				}
			}
		}
		return osa ? os : os[0] ?? '';
	}

	function str_pad(input, padLength, padString, padType) {
		let half = '';
		let padToGo;
		const _strPadRepeater = function(s, len) {
			let collect = '';
			while (collect.length < len) {
				collect += s;
			}
			collect = collect.substr(0, len);
			return collect;
		};
		input += '';
		padString = padString !== undefined ? padString : ' ';
		if (padType !== 'STR_PAD_LEFT' && padType !== 'STR_PAD_RIGHT' && padType !== 'STR_PAD_BOTH') {
			padType = 'STR_PAD_RIGHT';
		}
		if ((padToGo = padLength - input.length) > 0) {
			if (padType === 'STR_PAD_LEFT') {
				input = _strPadRepeater(padString, padToGo) + input;
			} else if (padType === 'STR_PAD_RIGHT') {
				input = input + _strPadRepeater(padString, padToGo);
			} else if (padType === 'STR_PAD_BOTH') {
				half = _strPadRepeater(padString, Math.ceil(padToGo / 2));
				input = half + input + half;
				input = input.substr(0, padLength);
			}
		}
		return input;
	}

	function str_repeat(input, multiplier) {
		let y = '';
		while (true) {
			if (multiplier & 1) {
				y += input;
			}
			multiplier >>= 1;
			if (multiplier) {
				input += input;
			} else {
				break;
			}
		}
		return y;
	}

	function str_replace(search, replace, subject, countObj) {
		let i = 0;
		let j = 0;
		let temp = '';
		let repl = '';
		let sl = 0;
		let fl = 0;
		const f = asArray(search);
		let r = asArray(replace);
		const s = asArray(subject);
		const sa = Array.isArray(subject);
		if (Array.isArray(search) && typeof replace === 'string') {
			temp = replace;
			const replaceArr = [];
			for (i = 0; i < search.length; i += 1) {
				replaceArr[i] = temp;
			}
			temp = '';
			r = [...replaceArr];
		}
		if (typeof countObj !== 'undefined') {
			countObj.value = 0;
		}
		for (i = 0, sl = s.length; i < sl; i++) {
			if (s[i] === undefined || s[i] === '') {
				continue;
			}
			for (j = 0, fl = f.length; j < fl; j++) {
				const findValue = f[j];
				if (findValue === undefined || findValue === '') {
					continue;
				}
				temp = (s[i] ?? '') + '';
				const replacement = r[j];
				repl = replacement ?? '';
				s[i] = temp.replaceAll(findValue, repl);
				if (typeof countObj !== 'undefined') {
					countObj.value = (countObj.value ?? 0) + temp.split(findValue).length - 1;
				}
			}
		}
		return sa ? s : s[0] ?? '';
	}

	function str_rot13(str) {
		return strval(str).replace(/[a-z]/gi, (function(s) {
			return String.fromCharCode(s.charCodeAt(0) + (s.toLowerCase() < 'n' ? 13 : -13));
		}));
	}

	function str_shuffle(...providedArgs) {
		if (providedArgs.length === 0) {
			throw new Error('Wrong parameter count for str_shuffle()');
		}
		const [input] = providedArgs;
		if (input === null) {
			return '';
		}
		let str = String(input);
		let newStr = '';
		let rand;
		let i = str.length;
		while (i) {
			rand = Math.floor(Math.random() * i);
			newStr += str.charAt(rand);
			str = str.substring(0, rand) + str.substr(rand + 1);
			i--;
		}
		return newStr;
	}

	function str_split(string, splitLength) {
		const normalizedSplitLength = splitLength === null || typeof splitLength === 'undefined' ? 1 : Number(splitLength);
		if (string === null || normalizedSplitLength < 1 || Number.isNaN(normalizedSplitLength)) {
			return false;
		}
		const input = String(string);
		const chunks = [];
		let pos = 0;
		const len = input.length;
		while (pos < len) {
			chunks.push(input.slice(pos, pos += normalizedSplitLength));
		}
		return chunks;
	}

	function str_word_count(str, format, charlist) {
		const len = str.length;
		const cl = charlist?.length ?? 0;
		let chr = '';
		let tmpStr = '';
		let c = '';
		const wArr = [];
		let wC = 0;
		const assoc = {};
		let aC = 0;
		let reg = null;
		let match = false;
		const _pregQuote = function(value) {
			return (value + '').replace(/([\\.+*?[^\]$(){}=!<>|:])/g, '\\$1');
		};
		const _getWholeChar = function(value, index) {
			const code = value.charCodeAt(index);
			if (code < 0xd800 || code > 0xdfff) {
				return value.charAt(index);
			}
			if (code >= 0xd800 && code <= 0xdbff) {
				if (value.length <= index + 1) {
					throw new Error('High surrogate without following low surrogate');
				}
				const next = value.charCodeAt(index + 1);
				if (next < 0xdc00 || next > 0xdfff) {
					throw new Error('High surrogate without following low surrogate');
				}
				return value.charAt(index) + value.charAt(index + 1);
			}
			if (index === 0) {
				throw new Error('Low surrogate without preceding high surrogate');
			}
			const prev = value.charCodeAt(index - 1);
			if (prev < 0xd800 || prev > 0xdbff) {
				throw new Error('Low surrogate without preceding high surrogate');
			}
			return false;
		};
		if (cl && typeof charlist === 'string') {
			const firstChar = _getWholeChar(charlist, 0);
			let pattern = '^(' + _pregQuote(firstChar === false ? '' : firstChar);
			for (let i = 1; i < cl; i++) {
				const wholeChar = _getWholeChar(charlist, i);
				if (wholeChar === false) {
					continue;
				}
				chr = wholeChar;
				pattern += '|' + _pregQuote(chr);
			}
			pattern += ')$';
			reg = new RegExp(pattern);
		}
		for (let i = 0; i < len; i++) {
			const wholeChar = _getWholeChar(str, i);
			if (wholeChar === false) {
				continue;
			}
			c = wholeChar;
			match = ctype_alpha(c) || reg !== null && reg.test(c) || i !== 0 && i !== len - 1 && c === '-' || i !== 0 && c === '\'';
			if (match) {
				if (tmpStr === '' && format === 2) {
					aC = i;
				}
				tmpStr = tmpStr + c;
			}
			if (i === len - 1 || !match && tmpStr !== '') {
				if (format !== 2) {
					wArr.push(tmpStr);
				} else {
					assoc[aC] = tmpStr;
				}
				tmpStr = '';
				wC++;
			}
		}
		if (!format) {
			return wC;
		} else if (format === 1) {
			return wArr;
		} else if (format === 2) {
			return assoc;
		}
		throw new Error('You have supplied an incorrect format');
	}

	function strcasecmp(fString1, fString2) {
		const string1 = (fString1 + '').toLowerCase();
		const string2 = (fString2 + '').toLowerCase();
		if (string1 > string2) {
			return 1;
		} else if (string1 === string2) {
			return 0;
		}
		return -1;
	}

	function strcmp(str1, str2) {
		return str1 === str2 ? 0 : str1 > str2 ? 1 : -1;
	}

	function strcoll(str1, str2) {
		setlocale('LC_ALL', 0);
		const localeCollation = getPhpLocaleGroup('LC_COLLATE', 'LC_COLLATE');
		if (!localeCollation) {
			return str1.localeCompare(str2);
		}
		const cmp = localeCollation.LC_COLLATE;
		if (typeof cmp !== 'function') {
			return str1.localeCompare(str2);
		}
		return cmp(str1, str2);
	}

	function strcspn(str, mask, start, length) {
		start = start || 0;
		length = typeof length === 'undefined' ? str.length : length || 0;
		if (start < 0) {
			start = str.length + start;
		}
		if (length < 0) {
			length = str.length - start + length;
		}
		const e = Math.min(str.length, start + length);
		if (start < 0 || start >= str.length || length <= 0) {
			return 0;
		}
		let lgth = 0;
		for (let i = start; i < e; i++) {
			if (mask.includes(str.charAt(i))) {
				break;
			}
			++lgth;
		}
		return lgth;
	}

	function strip_tags(input, allowed) {
		allowed = (((allowed || '') + '').toLowerCase().match(/<[a-z][a-z0-9]*>/g) || []).join('');
		const tags = /<\/?([a-z0-9]*)\b[^>]*>?/gi;
		const commentsAndPhpTags = /<!--[\s\S]*?-->|<\?(?:php)?[\s\S]*?\?>/gi;
		let after = _php_cast_string(input);
		after = after.endsWith('<') ? after.slice(0, -1) : after;
		while (true) {
			const before = after;
			after = before.replace(commentsAndPhpTags, '').replace(tags, (function($0, $1) {
				return allowed.includes('<' + $1.toLowerCase() + '>') ? $0 : '';
			}));
			if (before === after) {
				return after;
			}
		}
	}

	function stripos(fHaystack, fNeedle, fOffset) {
		const haystack = (fHaystack + '').toLowerCase();
		const needle = (fNeedle + '').toLowerCase();
		let index = 0;
		if ((index = haystack.indexOf(needle, fOffset)) !== -1) {
			return index;
		}
		return false;
	}

	function stripslashes(str) {
		if (!arguments.length) {
			throw new Error('stripslashes() expects exactly 1 argument, 0 given');
		}
		return strval(str).replace(/\\(.?)/g, (function(s, n1) {
			switch (n1) {
				case '\\':
					return '\\';
				case '0':
					return '\0';
				case '':
					return '';
				default:
					return n1;
			}
		}));
	}

	function stristr(haystack, needle, bool) {
		let pos = 0;
		haystack += '';
		pos = haystack.toLowerCase().indexOf((needle + '').toLowerCase());
		if (pos === -1) {
			return false;
		} else {
			if (bool) {
				return haystack.substr(0, pos);
			} else {
				return haystack.slice(pos);
			}
		}
	}

	function strlen(string) {
		if (!arguments.length) {
			throw new Error('strlen() expects exactly 1 argument, 0 given');
		}
		const str = strval(string);
		const iniVal = ini_get('unicode.semantics') || 'off';
		if (iniVal === 'off') {
			return str.length;
		}
		let i = 0;
		let lgth = 0;
		const getWholeChar = function(str, i) {
			const code = str.charCodeAt(i);
			if (code >= 0xd800 && code <= 0xdbff) {
				if (str.length <= i + 1) {
					throw new Error('High surrogate without following low surrogate');
				}
				const next = str.charCodeAt(i + 1);
				if (next < 0xdc00 || next > 0xdfff) {
					throw new Error('High surrogate without following low surrogate');
				}
				return str.charAt(i) + str.charAt(i + 1);
			} else if (code >= 0xdc00 && code <= 0xdfff) {
				if (i === 0) {
					throw new Error('Low surrogate without preceding high surrogate');
				}
				const prev = str.charCodeAt(i - 1);
				if (prev < 0xd800 || prev > 0xdbff) {
					throw new Error('Low surrogate without preceding high surrogate');
				}
				return false;
			}
			return str.charAt(i);
		};
		for (i = 0, lgth = 0; i < str.length; i++) {
			if (getWholeChar(str, i) === false) {
				continue;
			}
			lgth++;
		}
		return lgth;
	}

	function strnatcasecmp(...providedArgs) {
		if (providedArgs.length !== 2) {
			return null;
		}
		const [a, b] = providedArgs;
		return strnatcmp(_php_cast_string(a).toLowerCase(), _php_cast_string(b).toLowerCase());
	}

	function strnatcmp(left, right) {
		const leadingZeros = /^0+(?=\d)/;
		const whitespace = /^\s/;
		const digit = /^\d/;
		let leftValue = _php_cast_string(left);
		let rightValue = _php_cast_string(right);
		if (!leftValue.length || !rightValue.length) {
			return leftValue.length - rightValue.length;
		}
		let i = 0;
		let j = 0;
		leftValue = leftValue.replace(leadingZeros, '');
		rightValue = rightValue.replace(leadingZeros, '');
		while (i < leftValue.length && j < rightValue.length) {
			while (whitespace.test(leftValue.charAt(i))) {
				i++;
			}
			while (whitespace.test(rightValue.charAt(j))) {
				j++;
			}
			let ac = leftValue.charAt(i);
			let bc = rightValue.charAt(j);
			let aIsDigit = digit.test(ac);
			let bIsDigit = digit.test(bc);
			if (aIsDigit && bIsDigit) {
				let bias = 0;
				const fractional = ac === '0' || bc === '0';
				do {
					if (!aIsDigit) {
						return -1;
					} else if (!bIsDigit) {
						return 1;
					} else if (ac < bc) {
						if (!bias) {
							bias = -1;
						}
						if (fractional) {
							return -1;
						}
					} else if (ac > bc) {
						if (!bias) {
							bias = 1;
						}
						if (fractional) {
							return 1;
						}
					}
					ac = leftValue.charAt(++i);
					bc = rightValue.charAt(++j);
					aIsDigit = digit.test(ac);
					bIsDigit = digit.test(bc);
				} while (aIsDigit || bIsDigit);
				if (!fractional && bias) {
					return bias;
				}
				continue;
			}
			if (!ac || !bc) {
				continue;
			} else if (ac < bc) {
				return -1;
			} else if (ac > bc) {
				return 1;
			}
			i++;
			j++;
		}
		const iBeforeStrEnd = i < leftValue.length;
		const jBeforeStrEnd = j < rightValue.length;
		if (iBeforeStrEnd && !jBeforeStrEnd) {
			return 1;
		}
		if (!iBeforeStrEnd && jBeforeStrEnd) {
			return -1;
		}
		return 0;
	}

	function strncasecmp(argStr1, argStr2, len) {
		let diff;
		let i = 0;
		const str1 = (argStr1 + '').toLowerCase().substr(0, len);
		const str2 = (argStr2 + '').toLowerCase().substr(0, len);
		if (str1.length !== str2.length) {
			if (str1.length < str2.length) {
				len = str1.length;
				if (str2.substr(0, str1.length) === str1) {
					return str1.length - str2.length;
				}
			} else {
				len = str2.length;
				if (str1.substr(0, str2.length) === str2) {
					return str1.length - str2.length;
				}
			}
		} else {
			len = str1.length;
		}
		for (diff = 0, i = 0; i < len; i++) {
			diff = str1.charCodeAt(i) - str2.charCodeAt(i);
			if (diff !== 0) {
				return diff;
			}
		}
		return 0;
	}

	function strncmp(str1, str2, lgth) {
		const s1 = (str1 + '').substr(0, lgth);
		const s2 = (str2 + '').substr(0, lgth);
		return s1 === s2 ? 0 : s1 > s2 ? 1 : -1;
	}

	function strpbrk(haystack, charList) {
		for (let i = 0, len = haystack.length; i < len; ++i) {
			if (charList.includes(haystack.charAt(i))) {
				return haystack.slice(i);
			}
		}
		return false;
	}

	function strpos(haystack, needle, offset) {
		const i = (haystack + '').indexOf(needle, offset || 0);
		return i === -1 ? false : i;
	}

	function strrchr(haystack, needle) {
		let pos = 0;
		if (typeof needle !== 'string') {
			needle = String.fromCharCode(parseInt(needle, 10));
		}
		needle = needle.charAt(0);
		pos = haystack.lastIndexOf(needle);
		if (pos === -1) {
			return false;
		}
		return haystack.substr(pos);
	}

	function strrev(string) {
		string = string + '';
		const chars = ['\udc00-\udfff', '\u0300-\u036f', '\u0483-\u0489', '\u0591-\u05bd', '\u05bf', '\u05c1', '\u05c2', '\u05c4', '\u05c5', '\u05c7', '\u0610-\u061a', '\u064b-\u065e', '\u0670', '\u06d6-\u06dc', '\u06de-\u06e4', '\u06e7\u06e8', '\u06ea-\u06ed', '\u0711', '\u0730-\u074a', '\u07a6-\u07b0', '\u07eb-\u07f3', '\u0901-\u0903', '\u093c', '\u093e-\u094d', '\u0951-\u0954', '\u0962', '\u0963', '\u0981-\u0983', '\u09bc', '\u09be-\u09c4', '\u09c7', '\u09c8', '\u09cb-\u09cd', '\u09d7', '\u09e2', '\u09e3', '\u0a01-\u0a03', '\u0a3c', '\u0a3e-\u0a42', '\u0a47', '\u0a48', '\u0a4b-\u0a4d', '\u0a51', '\u0a70', '\u0a71', '\u0a75', '\u0a81-\u0a83', '\u0abc', '\u0abe-\u0ac5', '\u0ac7-\u0ac9', '\u0acb-\u0acd', '\u0ae2', '\u0ae3', '\u0b01-\u0b03', '\u0b3c', '\u0b3e-\u0b44', '\u0b47', '\u0b48', '\u0b4b-\u0b4d', '\u0b56', '\u0b57', '\u0b62', '\u0b63', '\u0b82', '\u0bbe-\u0bc2', '\u0bc6-\u0bc8', '\u0bca-\u0bcd', '\u0bd7', '\u0c01-\u0c03', '\u0c3e-\u0c44', '\u0c46-\u0c48', '\u0c4a-\u0c4d', '\u0c55', '\u0c56', '\u0c62', '\u0c63', '\u0c82', '\u0c83', '\u0cbc', '\u0cbe-\u0cc4', '\u0cc6-\u0cc8', '\u0cca-\u0ccd', '\u0cd5', '\u0cd6', '\u0ce2', '\u0ce3', '\u0d02', '\u0d03', '\u0d3e-\u0d44', '\u0d46-\u0d48', '\u0d4a-\u0d4d', '\u0d57', '\u0d62', '\u0d63', '\u0d82', '\u0d83', '\u0dca', '\u0dcf-\u0dd4', '\u0dd6', '\u0dd8-\u0ddf', '\u0df2', '\u0df3', '\u0e31', '\u0e34-\u0e3a', '\u0e47-\u0e4e', '\u0eb1', '\u0eb4-\u0eb9', '\u0ebb', '\u0ebc', '\u0ec8-\u0ecd', '\u0f18', '\u0f19', '\u0f35', '\u0f37', '\u0f39', '\u0f3e', '\u0f3f', '\u0f71-\u0f84', '\u0f86', '\u0f87', '\u0f90-\u0f97', '\u0f99-\u0fbc', '\u0fc6', '\u102b-\u103e', '\u1056-\u1059', '\u105e-\u1060', '\u1062-\u1064', '\u1067-\u106d', '\u1071-\u1074', '\u1082-\u108d', '\u108f', '\u135f', '\u1712-\u1714', '\u1732-\u1734', '\u1752', '\u1753', '\u1772', '\u1773', '\u17b6-\u17d3', '\u17dd', '\u180b-\u180d', '\u18a9', '\u1920-\u192b', '\u1930-\u193b', '\u19b0-\u19c0', '\u19c8', '\u19c9', '\u1a17-\u1a1b', '\u1b00-\u1b04', '\u1b34-\u1b44', '\u1b6b-\u1b73', '\u1b80-\u1b82', '\u1ba1-\u1baa', '\u1c24-\u1c37', '\u1dc0-\u1de6', '\u1dfe', '\u1dff', '\u20d0-\u20f0', '\u2de0-\u2dff', '\u302a-\u302f', '\u3099', '\u309a', '\ua66f-\ua672', '\ua67c', '\ua67d', '\ua802', '\ua806', '\ua80b', '\ua823-\ua827', '\ua880', '\ua881', '\ua8b4-\ua8c4', '\ua926-\ua92d', '\ua947-\ua953', '\uaa29-\uaa36', '\uaa43', '\uaa4c', '\uaa4d', '\ufb1e', '\ufe00-\ufe0f', '\ufe20-\ufe26'];
		const graphemeExtend = new RegExp('(.)([' + chars.join('') + ']+)', 'g');
		string = string.replace(graphemeExtend, '$2$1');
		return string.split('').reverse().join('');
	}

	function strripos(haystack, needle, offset) {
		haystack = (haystack + '').toLowerCase();
		needle = (needle + '').toLowerCase();
		let i = -1;
		if (typeof offset === 'number') {
			i = (haystack + '').slice(offset).lastIndexOf(needle);
			if (i !== -1) {
				i += offset;
			}
		} else {
			i = (haystack + '').lastIndexOf(needle);
		}
		return i >= 0 ? i : false;
	}

	function strrpos(haystack, needle, offset) {
		let i = -1;
		if (typeof offset === 'number') {
			i = (haystack + '').slice(offset).lastIndexOf(needle);
			if (i !== -1) {
				i += offset;
			}
		} else {
			i = (haystack + '').lastIndexOf(needle);
		}
		return i >= 0 ? i : false;
	}

	function strspn(str1, str2, start, lgth) {
		let found;
		let stri;
		let strj;
		let j = 0;
		let i = 0;
		start = start ? start < 0 ? str1.length + start : start : 0;
		lgth = lgth ? lgth < 0 ? str1.length + lgth - start : lgth : str1.length - start;
		str1 = str1.substr(start, lgth);
		for (i = 0; i < str1.length; i++) {
			found = 0;
			stri = str1.substring(i, i + 1);
			for (j = 0; j <= str2.length; j++) {
				strj = str2.substring(j, j + 1);
				if (stri === strj) {
					found = 1;
					break;
				}
			}
			if (found !== 1) {
				return i;
			}
		}
		return i;
	}

	function strstr(haystack, needle, bool) {
		let pos = 0;
		haystack += '';
		pos = haystack.indexOf(needle);
		if (pos === -1) {
			return false;
		} else {
			if (bool) {
				return haystack.substr(0, pos);
			} else {
				return haystack.slice(pos);
			}
		}
	}

	function strtok(str, tokens) {
		if (typeof tokens === 'undefined') {
			tokens = str;
			str = getPhpRuntimeString('strtokleftOver', '');
		}
		if (str.length === 0) {
			return false;
		}
		if (tokens.includes(str.charAt(0))) {
			return strtok(str.substring(1), tokens);
		}
		let i = 0;
		for (; i < str.length; i++) {
			if (tokens.includes(str.charAt(i))) {
				break;
			}
		}
		setPhpRuntimeEntry('strtokleftOver', str.substring(i + 1));
		return str.substring(0, i);
	}

	function strtolower(str) {
		if (!arguments.length) {
			throw new Error('strtolower() expects exactly 1 argument, 0 given');
		}
		return strval(str).toLowerCase();
	}

	function strtoupper(str) {
		if (!arguments.length) {
			throw new Error('strtoupper() expects exactly 1 argument, 0 given');
		}
		return strval(str).toUpperCase();
	}

	function strtr(str, trFrom, trTo) {
		let fr = '';
		let i = 0;
		let j = 0;
		let lenStr = 0;
		let lenFrom = 0;
		let sortByReference = false;
		let istr = '';
		const tmpFrom = [];
		const tmpTo = [];
		let ret = '';
		let match = false;
		if (typeof trFrom === 'object' && !Array.isArray(trFrom)) {
			sortByReference = ini_set('locutus.sortByReference', false);
			const sorted = krsort(trFrom);
			ini_set('locutus.sortByReference', sortByReference);
			if (typeof sorted === 'object') {
				for (fr in sorted) {
					if (sorted.hasOwnProperty(fr)) {
						tmpFrom.push(fr);
						tmpTo.push(sorted[fr]);
					}
				}
			}
			trFrom = tmpFrom;
			trTo = tmpTo;
		}
		lenStr = str.length;
		lenFrom = typeof trFrom === 'string' ? trFrom.length : trFrom.length;
		const fromStr = typeof trFrom === 'string' ? trFrom : null;
		const fromArr = Array.isArray(trFrom) ? trFrom : null;
		const toStr = typeof trTo === 'string' ? trTo : null;
		const toArr = Array.isArray(trTo) ? trTo : null;
		for (i = 0; i < lenStr; i++) {
			match = false;
			if (fromStr) {
				istr = str.charAt(i);
				for (j = 0; j < lenFrom; j++) {
					if (istr === fromStr.charAt(j)) {
						match = true;
						break;
					}
				}
			} else if (fromArr) {
				for (j = 0; j < lenFrom; j++) {
					const fromVal = fromArr[j];
					if (fromVal === undefined) {
						continue;
					}
					if (str.substr(i, fromVal.length) === fromVal) {
						match = true;
						i = i + fromVal.length - 1;
						break;
					}
				}
			}
			if (match) {
				ret += toStr ? toStr.charAt(j) : toArr ? toArr[j] : '';
			} else {
				ret += str.charAt(i);
			}
		}
		return ret;
	}

	function substr(input, start, len) {
		const str = _php_cast_string(input);
		const multibyte = ini_get('unicode.semantics') === 'on';
		const chars = multibyte ? str.match(/[\uD800-\uDBFF][\uDC00-\uDFFF]|[\s\S]/g) || [] : null;
		const inputLength = chars ? chars.length : str.length;
		let end = inputLength;
		if (start < 0) {
			start += end;
		}
		if (typeof len !== 'undefined') {
			if (len < 0) {
				end = len + end;
			} else {
				end = len + start;
			}
		}
		if (start > inputLength || start < 0 || start > end) {
			return false;
		}
		if (chars) {
			return chars.slice(start, end).join('');
		}
		return str.slice(start, end);
	}

	function substr_compare(mainStr, str, offset, length, caseInsensitivity) {
		if (!offset && offset !== 0) {
			throw new Error('Missing offset for substr_compare()');
		}
		if (offset < 0) {
			offset = mainStr.length + offset;
		}
		if (length && length > mainStr.length - offset) {
			return false;
		}
		length = length || mainStr.length - offset;
		mainStr = mainStr.substr(offset, length);
		str = str.substr(0, length);
		if (caseInsensitivity) {
			mainStr = (mainStr + '').toLowerCase();
			str = strval(str).toLowerCase();
			if (mainStr === str) {
				return 0;
			}
			return mainStr > str ? 1 : -1;
		}
		return mainStr === str ? 0 : mainStr > str ? 1 : -1;
	}

	function substr_count(haystack, needle, offset, length) {
		let cnt = 0;
		const normalizedHaystack = String(haystack);
		const normalizedNeedle = String(needle);
		const normalizedOffset = Number.isNaN(Number(offset)) ? 0 : Number(offset);
		const normalizedLength = Number.isNaN(Number(length)) ? 0 : Number(length);
		if (normalizedNeedle.length === 0) {
			return false;
		}
		let position = normalizedOffset - 1;
		while ((position = normalizedHaystack.indexOf(normalizedNeedle, position + 1)) !== -1) {
			if (normalizedLength > 0 && position + normalizedNeedle.length > normalizedLength) {
				return false;
			}
			cnt++;
		}
		return cnt;
	}

	function substr_replace(str, replace, start, length) {
		if (start < 0) {
			start = start + str.length;
		}
		length = length !== undefined ? length : str.length;
		if (length < 0) {
			length = length + str.length - start;
		}
		return [str.slice(0, start), replace.substr(0, length), replace.slice(length), str.slice(start + length)].join('');
	}

	function trim(str, charlist) {
		if (!arguments.length) {
			throw new Error('trim() expects at least 1 argument, 0 given');
		}
		let whitespace = [' ', '\n', '\r', '\t', '\f', '\v', '\xa0', '\u2000', '\u2001', '\u2002', '\u2003', '\u2004', '\u2005', '\u2006', '\u2007', '\u2008', '\u2009', '\u200a', '\u200b', '\u2028', '\u2029', '\u3000'].join('');
		let l = 0;
		let i = 0;
		let strValue = strval(str);
		if (charlist) {
			whitespace = (charlist + '').replace(/([[\]().?/*{}+$^:])/g, '$1');
		}
		l = strValue.length;
		for (i = 0; i < l; i++) {
			if (!whitespace.includes(strValue.charAt(i))) {
				strValue = strValue.substring(i);
				break;
			}
		}
		l = strValue.length;
		for (i = l - 1; i >= 0; i--) {
			if (!whitespace.includes(strValue.charAt(i))) {
				strValue = strValue.substring(0, i + 1);
				break;
			}
		}
		return whitespace.includes(strValue.charAt(0)) ? '' : strValue;
	}

	function ucfirst(str) {
		str += '';
		const f = str.charAt(0).toUpperCase();
		return f + str.substr(1);
	}

	function ucwords(str) {
		return strval(str).replace(/^(.)|\s+(.)/g, (function($1) {
			return $1.toUpperCase();
		}));
	}

	function vprintf(format, ...restArgs) {
		let values = [];
		if (restArgs.length === 1 && Array.isArray(restArgs[0])) {
			values = restArgs[0];
		} else {
			values = restArgs;
		}
		const ret = sprintf(format, ...values);
		if (ret === false) {
			return 0;
		}
		echo(ret);
		return ret.length;
	}

	function vsprintf(format, args) {
		return sprintf(format, ...args);
	}

	function wordwrap(...rawArgs) {
		let [str, intWidth, strBreak, cut] = rawArgs;
		intWidth = rawArgs.length >= 2 ? +(intWidth ?? 0) : 75;
		strBreak = rawArgs.length >= 3 ? '' + (strBreak ?? '') : '\n';
		cut = rawArgs.length >= 4 ? !!cut : false;
		let i;
		let j;
		let line;
		str += '';
		if (intWidth < 1) {
			return str;
		}
		const reLineBreaks = /\r\n|\n|\r/;
		const reBeginningUntilFirstWhitespace = /^\S*/;
		const reLastCharsWithOptionalTrailingWhitespace = /\S*(\s)?$/;
		const lines = str.split(reLineBreaks);
		const l = lines.length;
		let match;
		for (i = 0; i < l; lines[i++] += line) {
			line = lines[i] ?? '';
			lines[i] = '';
			while (line.length > intWidth) {
				const slice = line.slice(0, intWidth + 1);
				let ltrim = 0;
				let rtrim = 0;
				match = slice.match(reLastCharsWithOptionalTrailingWhitespace);
				if (!match) {
					break;
				}
				if (match[1]) {
					j = intWidth;
					ltrim = 1;
				} else {
					j = slice.length - match[0].length;
					if (j) {
						rtrim = 1;
					}
					if (!j && cut && intWidth) {
						j = intWidth;
					}
					if (!j) {
						const charsUntilNextWhitespace = (line.slice(intWidth).match(reBeginningUntilFirstWhitespace) || [''])[0];
						j = slice.length + charsUntilNextWhitespace.length;
					}
				}
				lines[i] += line.slice(0, j - rtrim);
				line = line.slice(j + ltrim);
				lines[i] += line.length ? strBreak : '';
			}
		}
		return lines.join('\n');
	}

	function base64_decode(encodedData) {
		const decodeUTF8string = function(str) {
			return decodeURIComponent(str.split('').map((function(c) {
				return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
			})).join(''));
		};
		const bufferValue = getPhpGlobalEntry('Buffer');
		if (isObjectLike(bufferValue)) {
			const bufferFrom = getPhpObjectEntry(bufferValue, 'from');
			if (isPhpCallable(bufferFrom)) {
				const decoded = bufferFrom.call(bufferValue, String(encodedData), 'base64');
				if (typeof decoded === 'object' && decoded !== null) {
					const decodedToString = getPhpObjectEntry(decoded, 'toString');
					if (isPhpCallable(decodedToString)) {
						const utf8Value = decodedToString.call(decoded, 'utf-8');
						if (typeof utf8Value === 'string') {
							return utf8Value;
						}
					}
				}
			}
		}
		const atobValue = getPhpGlobalCallable('atob');
		if (atobValue) {
			const decoded = atobValue(String(encodedData));
			if (typeof decoded === 'string') {
				return decodeUTF8string(decoded);
			}
		}
		const b64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
		let o1;
		let o2;
		let o3;
		let h1;
		let h2;
		let h3;
		let h4;
		let bits;
		let i = 0;
		let ac = 0;
		let dec = '';
		const tmpArr = [];
		if (!encodedData) {
			return encodedData;
		}
		encodedData += '';
		do {
			h1 = b64.indexOf(encodedData.charAt(i++));
			h2 = b64.indexOf(encodedData.charAt(i++));
			h3 = b64.indexOf(encodedData.charAt(i++));
			h4 = b64.indexOf(encodedData.charAt(i++));
			bits = h1 << 18 | h2 << 12 | h3 << 6 | h4;
			o1 = bits >> 16 & 0xff;
			o2 = bits >> 8 & 0xff;
			o3 = bits & 0xff;
			if (h3 === 64) {
				tmpArr[ac++] = String.fromCharCode(o1);
			} else if (h4 === 64) {
				tmpArr[ac++] = String.fromCharCode(o1, o2);
			} else {
				tmpArr[ac++] = String.fromCharCode(o1, o2, o3);
			}
		} while (i < encodedData.length);
		dec = tmpArr.join('');
		return decodeUTF8string(dec.replace(/\0+$/, ''));
	}

	function base64_encode(stringToEncode) {
		const encodeUTF8string = function(str) {
			return encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, (function toSolidBytes(_match, p1) {
				return String.fromCharCode(Number.parseInt(p1, 16));
			}));
		};
		const bufferValue = getPhpGlobalEntry('Buffer');
		if (isObjectLike(bufferValue)) {
			const bufferFrom = getPhpObjectEntry(bufferValue, 'from');
			if (isPhpCallable(bufferFrom)) {
				const encoded = bufferFrom.call(bufferValue, String(stringToEncode));
				if (typeof encoded === 'object' && encoded !== null) {
					const encodedToString = getPhpObjectEntry(encoded, 'toString');
					if (isPhpCallable(encodedToString)) {
						const base64Value = encodedToString.call(encoded, 'base64');
						if (typeof base64Value === 'string') {
							return base64Value;
						}
					}
				}
			}
		}
		const btoaValue = getPhpGlobalCallable('btoa');
		if (btoaValue) {
			const encoded = btoaValue(encodeUTF8string(String(stringToEncode)));
			if (typeof encoded === 'string') {
				return encoded;
			}
		}
		const b64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
		let o1;
		let o2;
		let o3;
		let h1;
		let h2;
		let h3;
		let h4;
		let bits;
		let i = 0;
		let ac = 0;
		let enc = '';
		const tmpArr = [];
		if (!stringToEncode) {
			return stringToEncode;
		}
		stringToEncode = encodeUTF8string(stringToEncode);
		do {
			o1 = stringToEncode.charCodeAt(i++);
			o2 = stringToEncode.charCodeAt(i++);
			o3 = stringToEncode.charCodeAt(i++);
			bits = o1 << 16 | o2 << 8 | o3;
			h1 = bits >> 18 & 0x3f;
			h2 = bits >> 12 & 0x3f;
			h3 = bits >> 6 & 0x3f;
			h4 = bits & 0x3f;
			tmpArr[ac++] = b64.charAt(h1) + b64.charAt(h2) + b64.charAt(h3) + b64.charAt(h4);
		} while (i < stringToEncode.length);
		enc = tmpArr.join('');
		const r = stringToEncode.length % 3;
		return (r ? enc.slice(0, r - 3) : enc) + '==='.slice(r || 3);
	}

	function http_build_query(formdata, numericPrefix, argSeparator, encType) {
		let encodeFunc;
		switch (encType) {
			case 'PHP_QUERY_RFC3986':
				encodeFunc = rawurlencode;
				break;
			case 'PHP_QUERY_RFC1738':
			default:
				encodeFunc = urlencode;
				break;
		}
		const tmp = [];
		const _httpBuildQueryHelper = function(key, val, separator) {
			const nested = [];
			if (val === true) {
				val = '1';
			} else if (val === false) {
				val = '0';
			}
			if (val !== null) {
				if (typeof val === 'object') {
					if (Array.isArray(val)) {
						for (let nestedIndex = 0; nestedIndex < val.length; nestedIndex += 1) {
							const nestedValue = val[nestedIndex];
							if (typeof nestedValue !== 'undefined' && nestedValue !== null) {
								nested.push(_httpBuildQueryHelper(key + '[' + nestedIndex + ']', nestedValue, separator));
							}
						}
					} else {
						for (const [nestedKey, nestedValue] of Object.entries(val)) {
							if (typeof nestedValue !== 'undefined' && nestedValue !== null) {
								nested.push(_httpBuildQueryHelper(key + '[' + nestedKey + ']', nestedValue, separator));
							}
						}
					}
					return nested.join(separator);
				} else {
					return encodeFunc(key) + '=' + encodeFunc(String(val));
				}
			} else {
				return '';
			}
		};
		const separator = argSeparator || '&';
		if (Array.isArray(formdata)) {
			for (let index = 0; index < formdata.length; index += 1) {
				const value = formdata[index];
				if (typeof value === 'undefined') {
					continue;
				}
				let queryKey = String(index);
				if (numericPrefix) {
					queryKey = String(numericPrefix) + queryKey;
				}
				const query = _httpBuildQueryHelper(queryKey, value, separator);
				if (query !== '') {
					tmp.push(query);
				}
			}
		} else {
			for (const [key, value] of Object.entries(formdata)) {
				if (typeof value === 'undefined') {
					continue;
				}
				let queryKey = key;
				if (numericPrefix && !Number.isNaN(Number(queryKey))) {
					queryKey = String(numericPrefix) + queryKey;
				}
				const query = _httpBuildQueryHelper(queryKey, value, separator);
				if (query !== '') {
					tmp.push(query);
				}
			}
		}
		return tmp.join(separator);
	}

	function parse_url(str, component) {
		let query;
		const mode = ini_get('locutus.parse_url.mode') || 'php';
		const key = ['source', 'scheme', 'authority', 'userInfo', 'user', 'pass', 'host', 'port', 'relative', 'path', 'directory', 'file', 'query', 'fragment'];
		const parser = {
			'php': new RegExp(['(?:([^:\\/?#]+):)?', '(?:\\/\\/()(?:(?:()(?:([^:@\\/]*):?([^:@\\/]*))?@)?([^:\\/?#]*)(?::(\\d*))?))?', '()', '(?:(()(?:(?:[^?#\\/]*\\/)*)()(?:[^?#]*))(?:\\?([^#]*))?(?:#(.*))?)'].join('')),
			'strict': new RegExp(['(?:([^:\\/?#]+):)?', '(?:\\/\\/((?:(([^:@\\/]*):?([^:@\\/]*))?@)?([^:\\/?#]*)(?::(\\d*))?))?', '((((?:[^?#\\/]*\\/)*)([^?#]*))(?:\\?([^#]*))?(?:#(.*))?)'].join('')),
			'loose': new RegExp(['(?:(?![^:@]+:[^:@\\/]*@)([^:\\/?#.]+):)?', '(?:\\/\\/\\/?)?', '((?:(([^:@\\/]*):?([^:@\\/]*))?@)?([^:\\/?#]*)(?::(\\d*))?)', '(((\\/(?:[^?#](?![^?#\\/]*\\.[^?#\\/.]+(?:[?#]|$)))*\\/?)?([^?#\\/]*))', '(?:\\?([^#]*))?(?:#(.*))?)'].join(''))
		};
		const parserMode = mode === 'php' || mode === 'strict' || mode === 'loose' ? mode : 'php';
		const selectedParser = parser[parserMode];
		const m = selectedParser.exec(str);
		const uri = {};
		if (!m) {
			return uri;
		}
		let i = 14;
		while (i--) {
			const keyName = key[i];
			if (keyName && m[i]) {
				uri[keyName] = m[i];
			}
		}
		if (component) {
			return String(uri[component.replace('PHP_URL_', '').toLowerCase()] ?? '');
		}
		if (mode !== 'php') {
			const name = ini_get('locutus.parse_url.queryKey') || 'queryKey';
			const queryParser = /(?:^|&)([^&=]*)=?([^&]*)/g;
			const queryObj = {};
			uri[name] = queryObj;
			const queryKeyName = key[12];
			query = String((queryKeyName ? uri[queryKeyName] : '') || '');
			query.replace(queryParser, (function($0, $1, $2) {
				if ($1) {
					queryObj[$1] = $2;
				}
				return $0;
			}));
		}
		delete uri.source;
		return uri;
	}

	function rawurldecode(str) {
		return decodeURIComponent(strval(str).replace(/%(?![\da-f]{2})/gi, (function() {
			return '%25';
		})));
	}

	function rawurlencode(str) {
		str = str + '';
		return encodeURIComponent(str).replace(/!/g, '%21').replace(/'/g, '%27').replace(/\(/g, '%28').replace(/\)/g, '%29').replace(/\*/g, '%2A');
	}

	function urldecode(str) {
		return decodeURIComponent(strval(str).replace(/%(?![\da-f]{2})/gi, (function() {
			return '%25';
		})).replace(/\+/g, '%20'));
	}

	function urlencode(str) {
		str = str + '';
		return encodeURIComponent(str).replace(/!/g, '%21').replace(/'/g, '%27').replace(/\(/g, '%28').replace(/\)/g, '%29').replace(/\*/g, '%2A').replace(/~/g, '%7E').replace(/%20/g, '+');
	}

	function boolval(mixedVar) {
		if (mixedVar === false) {
			return false;
		}
		if (mixedVar === 0 || mixedVar === 0.0) {
			return false;
		}
		if (mixedVar === '' || mixedVar === '0') {
			return false;
		}
		if (Array.isArray(mixedVar) && mixedVar.length === 0) {
			return false;
		}
		if (mixedVar === null || mixedVar === undefined) {
			return false;
		}
		return true;
	}

	function empty(mixedVar) {
		const emptyValues = [undefined, null, false, 0, '', '0'];
		for (const emptyValue of emptyValues) {
			if (mixedVar === emptyValue) {
				return true;
			}
		}
		if (typeof mixedVar === 'object' && mixedVar !== null) {
			return Object.keys(mixedVar).length === 0;
		}
		return false;
	}

	function floatval(mixedVar) {
		return parseFloat(String(mixedVar ?? '')) || 0;
	}

	function gettype(mixedVar) {
		let s = typeof mixedVar;
		let name = '';
		const _getFuncName = function(fn) {
			const funcNameMatch = /\W*function\s+([\w$]+)\s*\(/.exec(String(fn));
			if (!funcNameMatch) {
				return '(Anonymous)';
			}
			return funcNameMatch[1] ?? '(Anonymous)';
		};
		if (s === 'object') {
			if (typeof mixedVar === 'object' && mixedVar !== null) {
				const objectLike = mixedVar;
				const objectLength = getPhpObjectEntry(objectLike, 'length');
				const objectSplice = getPhpObjectEntry(objectLike, 'splice');
				if (typeof objectLength === 'number' && !Object.prototype.propertyIsEnumerable.call(objectLike, 'length') && typeof objectSplice === 'function') {
					s = 'array';
				} else {
					const constructorValue = getPhpObjectEntry(objectLike, 'constructor');
					if (!constructorValue) {
						return s;
					}
					name = _getFuncName(constructorValue);
					if (name === 'Date') {
						s = 'date';
					} else if (name === 'RegExp') {
						s = 'regexp';
					} else if (name === 'LOCUTUS_Resource') {
						s = 'resource';
					}
				}
			} else {
				s = 'null';
			}
		} else if (typeof mixedVar === 'number') {
			s = is_float(mixedVar) ? 'double' : 'integer';
		}
		return s;
	}

	function intval(mixedVar, base) {
		let tmp = 0;
		if (typeof mixedVar === 'boolean') {
			return Number(mixedVar);
		} else if (typeof mixedVar === 'string') {
			if (base === 0) {
				const match = mixedVar.match(/^\s*0(x?)/i);
				base = match ? match[1] ? 16 : 8 : 10;
			}
			tmp = Number.parseInt(mixedVar, base || 10);
			return Number.isNaN(tmp) || !Number.isFinite(tmp) ? 0 : tmp;
		} else if (typeof mixedVar === 'bigint') {
			return Number(mixedVar);
		} else if (typeof mixedVar === 'number' && Number.isFinite(mixedVar)) {
			return mixedVar < 0 ? Math.ceil(mixedVar) : Math.floor(mixedVar);
		} else {
			return 0;
		}
	}
	const hasNumericLength = value => value !== null && typeof value === 'object' && typeof getPhpObjectEntry(value, 'length') === 'number';

	function is_array(mixedVar) {
		const _getFuncName = function(fn) {
			const name = /\W*function\s+([\w$]+)\s*\(/.exec(String(fn));
			if (!name) {
				return '(Anonymous)';
			}
			return name[1] ?? '(Anonymous)';
		};
		const _isArray = function(mixedVar) {
			if (!hasNumericLength(mixedVar)) {
				return false;
			}
			const candidate = mixedVar;
			const len = candidate.length;
			candidate[candidate.length] = 'bogus';
			if (len !== candidate.length) {
				candidate.length -= 1;
				return true;
			}
			delete candidate[candidate.length];
			return false;
		};
		if (!mixedVar || typeof mixedVar !== 'object') {
			return false;
		}
		const isArray = _isArray(mixedVar);
		if (isArray) {
			return true;
		}
		const iniVal = ini_get('locutus.objectsAsArrays') || 'on';
		if (iniVal === 'on') {
			const asString = Object.prototype.toString.call(mixedVar);
			const asFunc = _getFuncName(getPhpObjectEntry(mixedVar, 'constructor'));
			if (asString === '[object Object]' && asFunc === 'Object') {
				return true;
			}
		}
		return false;
	}

	function is_bool(mixedVar) {
		return mixedVar === true || mixedVar === false;
	}

	function is_callable(mixedVar, syntaxOnly, callableName) {
		const validJSFunctionNamePattern = /^[_$a-zA-Z\xA0-\uFFFF][_$a-zA-Z0-9\xA0-\uFFFF]*$/;
		let name = '';
		let obj = null;
		let method = '';
		let validFunctionName = false;
		const getFuncName = function(fn) {
			const funcNameMatch = /\W*function\s+([\w$]+)\s*\(/.exec(String(fn));
			if (!funcNameMatch) {
				return '(Anonymous)';
			}
			return funcNameMatch[1] ?? '(Anonymous)';
		};
		if (mixedVar == null) {
			return false;
		}
		if (/(^class|\(this,)/.test(String(mixedVar))) {
			return false;
		}
		if (typeof mixedVar === 'string') {
			obj = getPhpGlobalScope();
			method = mixedVar;
			name = mixedVar;
			validFunctionName = !!name.match(validJSFunctionNamePattern);
		} else if (typeof mixedVar === 'function') {
			return true;
		} else if (Array.isArray(mixedVar) && mixedVar.length === 2 && mixedVar[0] !== null && typeof mixedVar[0] === 'object' && typeof mixedVar[1] === 'string') {
			const receiver = toPhpArrayObject(mixedVar[0]);
			obj = receiver;
			method = mixedVar[1];
			name = (typeof receiver.constructor === 'function' ? getFuncName(receiver.constructor) : '(Anonymous)') + '::' + method;
		}
		const callableCandidate = obj ? getPhpObjectEntry(obj, method) : undefined;
		if (syntaxOnly || typeof callableCandidate === 'function') {
			if (callableName) {
				setPhpGlobalEntry(callableName, name);
			}
			return true;
		}
		if (validFunctionName && typeof eval(method) === 'function') {
			if (callableName) {
				setPhpGlobalEntry(callableName, name);
			}
			return true;
		}
		return false;
	}

	function is_float(mixedVar) {
		return +mixedVar === mixedVar && (!isFinite(mixedVar) || !!(mixedVar % 1));
	}

	function is_int(mixedVar) {
		const num = Number(mixedVar);
		return typeof mixedVar === 'number' && mixedVar === num && Number.isFinite(num) && Number.isInteger(num);
	}

	function is_null(mixedVar) {
		return mixedVar === null;
	}

	function is_numeric(mixedVar) {
		const whitespace = [' ', '\n', '\r', '\t', '\f', '\v', '\xa0', '\u2000', '\u2001', '\u2002', '\u2003', '\u2004', '\u2005', '\u2006', '\u2007', '\u2008', '\u2009', '\u200a', '\u200b', '\u2028', '\u2029', '\u3000'].join('');
		if (typeof mixedVar === 'number') {
			return !Number.isNaN(mixedVar);
		}
		if (typeof mixedVar !== 'string') {
			return false;
		}
		return mixedVar !== '' && whitespace.indexOf(mixedVar.slice(-1)) === -1 && !Number.isNaN(Number(mixedVar));
	}

	function is_object(mixedVar) {
		return isPhpAssocObject(mixedVar);
	}

	function is_scalar(mixedVar) {
		return isPhpScalar(mixedVar);
	}

	function is_string(mixedVar) {
		return typeof mixedVar === 'string';
	}

	function isset(...values) {
		if (values.length === 0) {
			throw new Error('Empty isset');
		}
		for (const value of values) {
			if (typeof value === 'undefined' || value === null) {
				return false;
			}
		}
		return true;
	}

	function print_r(array, returnVal) {
		let output = '';
		const padChar = ' ';
		const padVal = 4;
		const _repeatChar = function(len, padChar) {
			let str = '';
			for (let i = 0; i < len; i++) {
				str += padChar;
			}
			return str;
		};
		const _formatArray = function(obj, curDepth, padVal, padChar) {
			if (curDepth > 0) {
				curDepth++;
			}
			const basePad = _repeatChar(padVal * curDepth, padChar);
			const thickPad = _repeatChar(padVal * (curDepth + 1), padChar);
			let str = '';
			if (typeof obj === 'object' && obj !== null && obj.constructor) {
				const objectValue = toPhpArrayObject(obj);
				str += 'Array\n' + basePad + '(\n';
				for (const key in objectValue) {
					const value = objectValue[key];
					if (Array.isArray(value)) {
						str += thickPad;
						str += '[';
						str += key;
						str += '] => ';
						str += _formatArray(value, curDepth + 1, padVal, padChar);
					} else {
						str += thickPad;
						str += '[';
						str += key;
						str += '] => ';
						str += value;
						str += '\n';
					}
				}
				str += basePad + ')\n';
			} else if (obj === null || obj === undefined) {
				str = '';
			} else {
				str = String(obj);
			}
			return str;
		};
		output = _formatArray(array, 0, padVal, padChar);
		if (returnVal !== true) {
			echo(output);
			return true;
		}
		return output;
	}

	function strval(str) {
		let type = '';
		if (!arguments.length) {
			throw new Error('strval() expects exactly 1 argument, 0 given');
		}
		if (typeof str === 'undefined') {
			return '';
		}
		if (str === null) {
			return '';
		}
		type = gettype(str);
		switch (type) {
			case 'boolean':
				if (str === true) {
					return '1';
				}
				return '';
			case 'array':
				return 'Array';
			case 'object':
				return 'Object';
		}
		return String(str);
	}
	const visitedObjects = new Map;
	const hasNodeName = value => typeof value === 'object' && value !== null && 'nodeName' in value;
	const isLocutusResource = (value, getFuncName) => {
		if (typeof value !== 'object' || value === null || !('var_dump' in value) || !('constructor' in value)) {
			return false;
		}
		const maybeResource = value;
		const varDump = getPhpObjectEntry(maybeResource, 'var_dump');
		const constructorValue = getPhpObjectEntry(maybeResource, 'constructor');
		return typeof varDump === 'function' && typeof constructorValue === 'function' && getFuncName(constructorValue) === 'LOCUTUS_Resource';
	};

	function var_dump(...args) {
		let output = '';
		const padChar = ' ';
		const padVal = 4;
		const _getFuncName = function(fn) {
			const name = /\W*function\s+([\w$]+)\s*\(/.exec(fn.toString());
			if (!name) {
				return '(Anonymous)';
			}
			return name[1] ?? '(Anonymous)';
		};
		const _repeatChar = function(len, padCharacter) {
			let str = '';
			for (let i = 0; i < len; i++) {
				str += padCharacter;
			}
			return str;
		};
		const _getInnerVal = function(val, thickPad) {
			let ret = '';
			if (val === null) {
				ret = 'NULL';
			} else if (typeof val === 'boolean') {
				ret = 'bool(' + val + ')';
			} else if (typeof val === 'string') {
				ret = 'string(' + val.length + ') "' + val + '"';
			} else if (typeof val === 'number') {
				if (Number.isInteger(val)) {
					ret = 'int(' + val + ')';
				} else {
					ret = 'float(' + val + ')';
				}
			} else if (typeof val === 'undefined') {
				ret = 'undefined';
			} else if (typeof val === 'function') {
				const funcLines = val.toString().split('\n');
				ret = '';
				for (let i = 0, fll = funcLines.length; i < fll; i++) {
					const line = funcLines[i] ?? '';
					ret += (i !== 0 ? '\n' + thickPad : '') + line;
				}
			} else if (val instanceof Date) {
				ret = 'Date(' + val + ')';
			} else if (val instanceof RegExp) {
				ret = 'RegExp(' + val + ')';
			} else if (hasNodeName(val)) {
				switch (val.nodeType) {
					case 1:
						if (typeof val.namespaceURI === 'undefined' || val.namespaceURI === 'https://www.w3.org/1999/xhtml') {
							ret = 'HTMLElement("' + val.nodeName + '")';
						} else {
							ret = 'XML Element("' + val.nodeName + '")';
						}
						break;
					case 2:
						ret = 'ATTRIBUTE_NODE(' + val.nodeName + ')';
						break;
					case 3:
						ret = 'TEXT_NODE(' + val.nodeValue + ')';
						break;
					case 4:
						ret = 'CDATA_SECTION_NODE(' + val.nodeValue + ')';
						break;
					case 5:
						ret = 'ENTITY_REFERENCE_NODE';
						break;
					case 6:
						ret = 'ENTITY_NODE';
						break;
					case 7:
						ret = 'PROCESSING_INSTRUCTION_NODE(' + val.nodeName + ':' + val.nodeValue + ')';
						break;
					case 8:
						ret = 'COMMENT_NODE(' + val.nodeValue + ')';
						break;
					case 9:
						ret = 'DOCUMENT_NODE';
						break;
					case 10:
						ret = 'DOCUMENT_TYPE_NODE';
						break;
					case 11:
						ret = 'DOCUMENT_FRAGMENT_NODE';
						break;
					case 12:
						ret = 'NOTATION_NODE';
						break;
				}
			}
			return ret;
		};
		const _formatArray = function(obj, curDepth, padVal, padChar, visitedObjectMap) {
			if (curDepth > 0) {
				curDepth++;
			}
			const basePad = _repeatChar(padVal * (curDepth - 1), padChar);
			const thickPad = _repeatChar(padVal * (curDepth + 1), padChar);
			let str = '';
			let val = '';
			if (typeof obj === 'object' && obj !== null) {
				if (visitedObjectMap.has(obj)) {
					return 'Circular Reference Detected\n';
				} else {
					visitedObjectMap.set(obj, true);
				}
				if (isLocutusResource(obj, _getFuncName)) {
					return obj.var_dump();
				}
				let lgth = 0;
				const objRecord = toPhpArrayObject(obj);
				for (const someProp in objRecord) {
					if (Object.hasOwn(objRecord, someProp)) {
						lgth++;
					}
				}
				str += 'array(' + lgth + ') {\n';
				for (const key in objRecord) {
					if (!Object.hasOwn(objRecord, key)) {
						continue;
					}
					const objVal = objRecord[key];
					if (typeof objVal === 'object' && objVal !== null && !(objVal instanceof Date) && !(objVal instanceof RegExp) && !hasNodeName(objVal)) {
						str += thickPad;
						str += '[';
						str += key;
						str += '] =>\n';
						str += thickPad;
						str += _formatArray(objVal, curDepth + 1, padVal, padChar, visitedObjectMap);
					} else {
						val = _getInnerVal(objVal, thickPad);
						str += thickPad;
						str += '[';
						str += key;
						str += '] =>\n';
						str += thickPad;
						str += val;
						str += '\n';
					}
				}
				str += basePad + '}\n';
			} else {
				str = _getInnerVal(obj, thickPad);
			}
			return str;
		};
		output = _formatArray(args[0], 0, padVal, padChar, visitedObjects);
		for (let i = 1; i < args.length; i++) {
			output += '\n' + _formatArray(args[i], 0, padVal, padChar, visitedObjects);
		}
		echo(output);
		return output;
	}

	function var_export(mixedExpression, boolReturn, idtLevel = 2) {
		let retstr = '';
		let iret = '';
		let value = '';
		let cnt = 0;
		const x = [];
		let innerIndent = '';
		let outerIndent = '';
		const getFuncName = function(fn) {
			const name = /\W*function\s+([\w$]+)\s*\(/.exec(fn.toString());
			if (!name) {
				return '(Anonymous)';
			}
			return name[1] ?? '(Anonymous)';
		};
		const _isNormalInteger = function(input) {
			const number = Math.floor(Number(input));
			return number !== Infinity && String(number) === input && number >= 0;
		};
		const _makeIndent = function(indentLevel) {
			return new Array(Math.max(indentLevel, 0) + 1).join(' ');
		};
		const __getType = function(inp) {
			let i = 0;
			let match = null;
			let cons = '';
			const types = ['boolean', 'number', 'string', 'array'];
			const jsType = typeof inp;
			let type = jsType === 'boolean' || jsType === 'number' || jsType === 'string' || jsType === 'function' || jsType === 'undefined' || jsType === 'object' ? jsType : null;
			if (type === 'object' && typeof inp === 'object' && inp !== null) {
				const constructorValue = getPhpObjectEntry(inp, 'constructor');
				if (typeof constructorValue === 'function' && getFuncName(constructorValue) === 'LOCUTUS_Resource') {
					return 'resource';
				}
			}
			if (type === 'function') {
				return 'function';
			}
			if (type === 'object' && !inp) {
				return 'null';
			}
			if (type === 'object' && typeof inp === 'object' && inp !== null) {
				const constructorValue = getPhpObjectEntry(inp, 'constructor');
				if (typeof constructorValue !== 'function') {
					return 'object';
				}
				cons = constructorValue.toString();
				match = cons.match(/(\w+)\(/);
				if (match) {
					cons = (match[1] ?? '').toLowerCase();
				}
				for (i = 0; i < types.length; i++) {
					const knownType = types[i];
					if (knownType && cons === knownType) {
						type = knownType;
						break;
					}
				}
			}
			return type;
		};
		const type = __getType(mixedExpression);
		if (type === null) {
			retstr = 'NULL';
		} else if (type === 'array' || type === 'object') {
			const source = toPhpArrayObject(mixedExpression);
			outerIndent = _makeIndent(idtLevel - 2);
			innerIndent = _makeIndent(idtLevel);
			for (const [key, entry] of Object.entries(source)) {
				value = ' ';
				const subtype = __getType(entry);
				if (subtype === 'array' || subtype === 'object' || subtype === 'function') {
					value = ' \n';
				}
				value += String(var_export(entry, true, idtLevel + 2));
				const mappedKey = _isNormalInteger(key) ? key : `'${key}'`;
				x[cnt++] = innerIndent + mappedKey + ' =>' + value;
			}
			if (x.length > 0) {
				iret = x.join(',\n') + ',\n';
			}
			retstr = outerIndent + 'array (\n' + iret + outerIndent + ')';
		} else if (type === 'function') {
			outerIndent = _makeIndent(idtLevel - 2);
			retstr = outerIndent + '\\Closure::__set_state(array(\n' + outerIndent + '))';
		} else if (type === 'resource') {
			retstr = 'NULL';
		} else {
			if (typeof mixedExpression === 'string') {
				retstr = '\'' + mixedExpression.replace(/([\\'])/g, '\\$1').replace(/\0/g, '\\0') + '\'';
			} else if (mixedExpression === null) {
				retstr = null;
			} else if (typeof mixedExpression === 'number') {
				retstr = Number(mixedExpression);
			} else if (typeof mixedExpression === 'boolean') {
				retstr = Boolean(mixedExpression);
			} else {
				retstr = String(mixedExpression);
			}
		}
		if (!boolReturn) {
			echo(retstr);
			return null;
		}
		return retstr;
	}

	function pc_array_power_set(arr) {
		var results = [
			[]
		];
		for (var i in arr) {
			for (var j in results) {
				array_push(results, array_merge([arr[i]], results[j]));
			}
		}
		return results;
	}

	function _find_parens_sub(ptr, count) {
		var count = count || 0;
		var start_count = count;
		var hwm_count = start_count;
		var i = 0;
		var dup_parens = false;
		if (ptr[0] == '(') {
			if (ptr[1] == '?' && ptr[2] == '|') {
				i += 3;
				dup_parens = true;
			} else if (ptr[1] != '?' && ptr[1] != '*') {
				count += 1;
				i++;
			} else if (ptr[i + 2] == '(') {
				i += 2;
				if (ptr[i + 1] != '(') {
					while (!!ptr[i] && ptr[i] != ')') {
						i++;
					}
					if (ptr[i] != 0) {
						i++;
					}
				}
			} else {
				i += 2;
				if (ptr[i] == 'P') {
					i++;
				}
				if (ptr[i] == '<' && ptr[i + 1] != '!' && ptr[i + 1] != '=' || ptr[i] == '\'') {
					count++;
				}
			}
		}
		for (; !!ptr[i]; i++) {
			if (ptr[i] == '\\') {
				if (!ptr[++i]) {
					throw new Error('Weird backslash ?');
				}
				if (ptr[i] == 'Q') {
					for (;;) {
						while (!!ptr[++i] && ptr[i] != '\\') {}
						if (!ptr[i]) {
							throw new Error('No \\E ?');
						}
						if (ptr[++i] == 'E') {
							break;
						}
					}
				}
				continue;
			}
			if (ptr[i] == '[') {
				var negate_class = false;
				for (;;) {
					var c = ptr[++i];
					if (c == '\\') {
						if (ptr[i] == 'E') {
							i++;
						} else if (strncmp(ptr.substr(i + 1, 3), 'Q\\E', 3) === 0) {
							i += 3;
						} else {
							break;
						}
					} else if (!negate_class && c == '^') {
						negate_class = true;
					} else {
						break;
					}
				}
				if (ptr[i] == ']' && false) {
					i++;
				}
				while (ptr[++i] != ']') {
					if (!ptr[i]) {
						return count;
					}
					if (ptr[i] == '\\') {
						if (!ptr[++i]) {
							throw new Error('Weird backslash ?');
						}
						if (ptr[i] == 'Q') {
							for (;;) {
								while (!!ptr[++i] && ptr[i] != '\\') {}
								if (!ptr[i]) {
									throw new Error('No \\E ?');
								}
								if (ptr[++i] == 'E') {
									break;
								}
							}
						}
						continue;
					}
				}
				continue;
			}
			if (ptr[i] == '(') {
				count = _find_parens_sub(ptr.slice(i), count);
				return count;
			} else if (ptr[i] == ')') {
				if (dup_parens && count < hwm_count) {
					count = hwm_count;
				}
			} else if (ptr[i] == '|' && dup_parens) {
				if (count > hwm_count) {
					hwm_count = count;
				}
				count = start_count;
			}
		}
		return count;
	}

	function preg_match_all(pattern, s, flag, offset) {
		var order = flag || 'PREG_PATTERN_ORDER';
		var matches = [];
		var nbP = _find_parens_sub(pattern.source);
		if (typeof offset !== 'undefined' && offset > 0) {
			var ps = pattern.toString();
			var delimiter = ps.charAt(0);
			var t = ps.split(delimiter);
			t.shift();
			var flags = t.pop();
			t[0] = '.{' + offset + '}' + t[0];
			ps = t.join(delimiter);
			pattern = new RegExp(ps, flags);
		}
		if (order == 'PREG_PATTERN_ORDER' || order == 'PREG_OFFSET_CAPTURE') {
			for (var i = 0; i < 1 + nbP; i++) {
				matches[i] = [];
			}
		}
		s.replace(pattern, (function() {
			var args = [].slice.call(arguments);
			var fullMatch = args.pop();
			var offset = args.pop();
			var substr = args[0];
			if (order === 'PREG_SET_ORDER') {
				matches.push(args);
			} else if (order === 'PREG_PATTERN_ORDER') {
				var l = args.length;
				matches[0].push(substr);
				for (var i = 1; i < l; i++) {
					if (!matches[i]) {
						matches[i] = [];
					}
					matches[i].push(args[i]);
				}
			} else if (order === 'PREG_OFFSET_CAPTURE') {
				if (!matches[0]) {
					matches[0] = [];
				}
				matches[0].push([args[0], offset]);
				var l = args.length;
				for (var i = 1; i < l; i++) {
					if (!matches[i]) {
						matches[i] = [];
					}
					matches[i].push([args[i], fullMatch.indexOf(args[i])]);
				}
			}
		}));
		return matches;
	}

	function array_diff_assoc_recursive(arr1, ...args) {
		const retArr = is_object(arr1) ? {} : [];
		for (const key in arr1) {
			if (!Object.prototype.hasOwnProperty.call(arr1, key)) {
				continue;
			}
			const val1 = arr1[key];
			let isDifferent = true;
			for (let i = 0; i < args.length; i++) {
				const arr = args[i];
				if (!(key in arr)) {
					continue;
				}
				const val2 = arr[key];
				if (is_array(val1) && is_array(val2)) {
					const diff = array_diff_assoc_recursive(val1, val2);
					if (Object.keys(diff).length === 0) {
						isDifferent = false;
						break;
					} else {
						retArr[key] = diff;
						isDifferent = false;
						break;
					}
				} else {
					if (val1 === val2) {
						isDifferent = false;
						break;
					}
				}
			}
			if (isDifferent) {
				retArr[key] = is_array(val1) ? structuredClone(val1) : val1;
			}
		}
		return retArr;
	}

	function array_first(array) {
		var key = array_key_first(array);
		if (is_null(key)) {
			return null;
		}
		return array[key];
	}

	function array_last(array) {
		var key = array_key_last(array);
		if (is_null(key)) {
			return null;
		}
		return array[key];
	}

	function json_decode(strJson) {
		try {
			setPhpRuntimeEntry('last_error_json', 0);
			return JSON.parse(strJson);
		} catch (e) {
			setPhpRuntimeEntry('last_error_json', 4);
			return null;
		}
	}

	function json_encode(mixedVal) {
		try {
			setPhpRuntimeEntry('last_error_json', 0);
			return JSON.stringify(mixedVal) ?? null;
		} catch (e) {
			setPhpRuntimeEntry('last_error_json', 4);
			return null;
		}
	}
	function str_contains(haystack, needle) {
		return strval(haystack).includes(strval(needle));
	}
	function str_starts_with(haystack, needle) {
		return strval(haystack).startsWith(strval(needle));
	}
	function str_ends_with(haystack, needle) {
		return strval(haystack).endsWith(strval(needle));
	}
	setlocale('LC_ALL', 0);
	ini_set('unicode.semantics', 'on');
	ini_set('locutus.sortByReference', 'on');
	ini_set('locutus.objectsAsArrays', 'on');
	ini_set('locutus.parse_url.mode', 'php');
	ini_set('locutus.parse_url.queryKey', 'queryKey');
	[array_change_key_case, array_chunk, array_column, array_combine, array_count_values, array_diff, array_diff_assoc, array_diff_key, array_diff_uassoc, array_diff_ukey, array_fill, array_fill_keys, array_filter, array_flip, array_intersect, array_intersect_assoc, array_intersect_key, array_intersect_uassoc, array_intersect_ukey, array_is_list, array_key_exists, array_key_first, array_key_last, array_keys, array_map, array_merge, array_merge_recursive, array_multisort, array_pad, array_pop, array_product, array_push, array_rand, array_reduce, array_replace, array_replace_recursive, array_reverse, array_search, array_shift, array_slice, array_splice, array_sum, array_udiff, array_udiff_assoc, array_udiff_uassoc, array_uintersect, array_uintersect_uassoc, array_unique, array_unshift, array_values, array_walk, array_walk_recursive, arsort, asort, count, current, end, in_array, key, krsort, ksort, natcasesort, natsort, next, prev, range, reset, rsort, shuffle, sort, uasort, uksort, usort, bcadd, bccomp, bcdiv, bcmul, bcround, bcscale, bcsub, ctype_alnum, ctype_alpha, ctype_cntrl, ctype_digit, ctype_graph, ctype_lower, ctype_print, ctype_punct, ctype_space, ctype_upper, ctype_xdigit, checkdate, date, date_parse, getdate, gettimeofday, gmdate, gmmktime, idate, microtime, mktime, strtotime, time, basename, dirname, pathinfo, realpath, call_user_func, call_user_func_array, function_exists, get_defined_functions, getenv, ini_get, ini_set, version_compare, json_last_error, abs, acos, acosh, asin, asinh, atan, atan2, atanh, base_convert, bindec, ceil, cos, cosh, decbin, dechex, decoct, deg2rad, exp, expm1, floor, fmod, getrandmax, hexdec, hypot, is_finite, is_infinite, is_nan, log, log10, log1p, max, min, mt_getrandmax, mt_rand, octdec, pi, pow, rad2deg, rand, round, sin, sinh, sqrt, tan, tanh, pack, uniqid, unpack, inet_ntop, inet_pton, ip2long, long2ip, setcookie, setrawcookie, preg_match, preg_quote, preg_replace, addcslashes, addslashes, bin2hex, chr, chunk_split, convert_uuencode, count_chars, crc32, echo, explode, get_html_translation_table, hex2bin, html_entity_decode, htmlentities, htmlspecialchars, htmlspecialchars_decode, implode, lcfirst, levenshtein, localeconv, ltrim, md5, metaphone, nl2br, nl_langinfo, number_format, ord, parse_str, printf, quoted_printable_decode, quoted_printable_encode, quotemeta, rtrim, setlocale, similar_text, soundex, sprintf, sscanf, str_getcsv, str_ireplace, str_pad, str_repeat, str_replace, str_rot13, str_shuffle, str_split, str_word_count, strcasecmp, strcmp, strcoll, strcspn, strip_tags, stripos, stripslashes, stristr, strlen, strnatcasecmp, strnatcmp, strncasecmp, strncmp, strpbrk, strpos, strrchr, strrev, strripos, strrpos, strspn, strstr, strtok, strtolower, strtoupper, strtr, substr, substr_compare, substr_count, substr_replace, trim, ucfirst, ucwords, vprintf, vsprintf, wordwrap, base64_decode, base64_encode, http_build_query, parse_url, rawurldecode, rawurlencode, urldecode, urlencode, boolval, empty, floatval, gettype, intval, is_array, is_bool, is_callable, is_float, is_int, is_null, is_numeric, is_object, is_scalar, is_string, isset, print_r, strval, var_dump, var_export, pc_array_power_set, preg_match_all, array_diff_assoc_recursive, array_first, array_last, json_decode, json_encode,str_contains,str_starts_with,str_ends_with].forEach((fn => {
		if (fn.name in global) {
			throw new Error(`[Locutus Conflict] Function "${fn.name}" is already defined.`);
		}
		Object.defineProperty(global, fn.name, {
			'value': fn,
			'writable': false,
			'configurable': false,
			'enumerable': true
		});
	}));
})($GLOBALS);