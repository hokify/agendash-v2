module.exports = {
	extends: ['@hokify/eslint-config'],
	parserOptions: {
		project: 'tsconfig.json'
	},
	rules: {
		'no-undef': 0,
		'no-underscore-dangle': 0,
		'global-require': 0,
		'no-param-reassign': 0,
		'import/no-unresolved': 0
	}
};
