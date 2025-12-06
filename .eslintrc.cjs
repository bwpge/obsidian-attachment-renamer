const path = require("path");

module.exports = {
	root: true,
	parser: "@typescript-eslint/parser",
	env: { node: true },
	plugins: ["@typescript-eslint"],
	extends: [
		"eslint:recommended",
		"plugin:eslint-comments/recommended",
		"plugin:@typescript-eslint/eslint-recommended",
		"plugin:@typescript-eslint/recommended",
		"plugin:@typescript-eslint/recommended-requiring-type-checking"
	],
	parserOptions: {
		sourceType: "module",
		project: path.join(__dirname, "tsconfig.json"),
		tsconfigRootDir: __dirname
	},
	rules: {
		"no-unused-vars": "off",
		"@typescript-eslint/no-unused-vars": ["error", {
			args: "after-used",
			argsIgnorePattern: "^_",
			varsIgnorePattern: "^_",
			caughtErrors: "all",
		}],
		"@typescript-eslint/ban-ts-comment": "off",
		"no-prototype-builtins": "off",
		"@typescript-eslint/no-empty-function": "off",
		"@typescript-eslint/no-unsafe-assignment": "off",
		"curly": ["error", "all"],
		"@typescript-eslint/no-floating-promises": "error",
		"@typescript-eslint/require-await": "error",
		"@typescript-eslint/no-misused-promises": "error",
		"no-console": ["error", { "allow": ["warn", "error", "debug"] }]
	}
};
