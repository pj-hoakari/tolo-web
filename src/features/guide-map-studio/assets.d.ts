// assets/ の GIF を import するための型（Next.js の画像の型）。
// ふだんは next-env.d.ts が読み込むが、next-env.d.ts は Git に入っていないので、CI の型チェック（tsc）にも届くようここでも読み込む
/// <reference types="next/image-types/global" />

// スタジオの見た目（studio-theme.css）を `import "./studio-theme.css"` で読み込むための型。
// 副作用だけの import も型を調べる TypeScript（エディタの TypeScript など）では、型が無いと TS2882 のエラーになる
declare module "*.css";
