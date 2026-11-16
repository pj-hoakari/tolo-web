// assets/ の GIF を import するための型（Next.js の画像の型）。
// ふだんは next-env.d.ts が読み込むが、next-env.d.ts は Git に入っていないので、CI の型チェック（tsc）にも届くようここでも読み込む
/// <reference types="next/image-types/global" />
