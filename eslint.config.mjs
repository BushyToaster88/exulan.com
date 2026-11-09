import reactHooks from "eslint-plugin-react-hooks"
import tseslint from "typescript-eslint"

export default tseslint.config(
	// Global ignores
	{
		ignores: [
			".next/**",
			"dist/**",
			"node_modules/**",
			"src/wasm/**",
			"public/wasm/**",
			"src/components/ui/**", // shadcn/ui generated components
			"!src/components/ui/_icons.tsx",
		],
	},
	// Base TypeScript recommended rules
	...tseslint.configs.recommended,
	// Project-specific overrides
	{
		files: ["src/**/*.{ts,tsx}"],
		plugins: {
			"react-hooks": reactHooks,
		},
		rules: {
			// React hooks
			...reactHooks.configs.recommended.rules,

			// Style — consistent with dprint config (semiColons: "asi", quoteStyle: "alwaysDouble")
			"semi": ["error", "never"],
			"quotes": ["error", "double", { avoidEscape: true }],

			// Relaxations that match the existing tsconfig philosophy
			"@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
			"@typescript-eslint/explicit-function-return-type": "off",
			"@typescript-eslint/no-non-null-assertion": "off",
			"@typescript-eslint/no-explicit-any": "warn",
		},
	},
	// JS config files (webpack, postcss, eslint itself)
	{
		files: ["*.{js,mjs,cjs}"],
		rules: {
			"@typescript-eslint/no-require-imports": "off",
		},
	},
)
