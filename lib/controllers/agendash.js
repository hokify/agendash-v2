/* eslint-disable @typescript-eslint/no-var-requires */
const mongodb = require('mongodb');

module.exports = (agenda, options) => {
	options = options || {};

	agenda.on('ready', () => {
		const { collection } = agenda.db;
		collection.createIndexes(
			[
				{ key: { nextRunAt: -1, lastRunAt: -1, lastFinishedAt: -1 } },
				{ key: { name: 1, nextRunAt: -1, lastRunAt: -1, lastFinishedAt: -1 } }
			],
			err => {
				if (err) {
					// catch silently
				}
			}
		);
	});

	const getJobs = (job, state, _options) => {
		const preMatch = {};
		if (job) {
			preMatch.name = job;
		}

		if (_options.query && _options.property) {
			if (_options.isObjectId) {
				preMatch[_options.property] = mongodb.ObjectID.createFromHexString(_options.query);
			} else if (/^\d+$/.test(_options.query)) {
				preMatch[_options.property] = parseInt(_options.query, 10);
			} else {
				preMatch[_options.property] = { $regex: _options.query, $options: 'i' };
			}
		}

		const postMatch = {};
		if (state) {
			postMatch[state] = true;
		}

		const { collection } = agenda.db;
		const result = collection
			.aggregate([
				{ $match: preMatch },
				{
					$sort: {
						nextRunAt: -1,
						lastRunAt: -1,
						lastFinishedAt: -1
					}
				},
				{
					$project: {
						job: '$$ROOT',
						_id: '$$ROOT._id',
						running: { $and: ['$lastRunAt', { $gt: ['$lastRunAt', '$lastFinishedAt'] }] },
						scheduled: { $and: ['$nextRunAt', { $gte: ['$nextRunAt', new Date()] }] },
						queued: {
							$and: [
								'$nextRunAt',
								{ $gte: [new Date(), '$nextRunAt'] },
								{ $gte: ['$nextRunAt', '$lastFinishedAt'] }
							]
						},
						completed: { $and: ['$lastFinishedAt', { $gt: ['$lastFinishedAt', '$failedAt'] }] },
						failed: {
							$and: ['$lastFinishedAt', '$failedAt', { $eq: ['$lastFinishedAt', '$failedAt'] }]
						},
						repeating: { $and: ['$repeatInterval', { $ne: ['$repeatInterval', null] }] }
					}
				},
				{ $match: postMatch },
				{
					$facet: {
						pages: [
							{ $count: 'totalMatchs' },
							{
								$project: {
									totalPages: { $ceil: { $divide: ['$totalMatchs', _options.limit] } }
								}
							}
						],
						filtered: [{ $skip: _options.skip }, { $limit: _options.limit }]
					}
				}
			])
			.toArray();
		return result;
	};

	const getOverview = () => {
		const { collection } = agenda.db;
		return collection
			.aggregate([
				{
					$group: {
						_id: '$name',
						displayName: { $first: '$name' },
						meta: {
							$addToSet: {
								type: '$type',
								priority: '$priority',
								repeatInterval: '$repeatInterval',
								repeatTimezone: '$repeatTimezone'
							}
						},
						total: { $sum: 1 },
						running: {
							$sum: {
								$cond: [{ $and: ['$lastRunAt', { $gt: ['$lastRunAt', '$lastFinishedAt'] }] }, 1, 0]
							}
						},
						scheduled: {
							$sum: {
								$cond: [{ $and: ['$nextRunAt', { $gte: ['$nextRunAt', new Date()] }] }, 1, 0]
							}
						},
						queued: {
							$sum: {
								$cond: [
									{
										$and: [
											'$nextRunAt',
											{ $gte: [new Date(), '$nextRunAt'] },
											{ $gte: ['$nextRunAt', '$lastFinishedAt'] }
										]
									},
									1,
									0
								]
							}
						},
						completed: {
							$sum: {
								$cond: [
									{ $and: ['$lastFinishedAt', { $gt: ['$lastFinishedAt', '$failedAt'] }] },
									1,
									0
								]
							}
						},
						failed: {
							$sum: {
								$cond: [
									{
										$and: [
											'$lastFinishedAt',
											'$failedAt',
											{ $eq: ['$lastFinishedAt', '$failedAt'] }
										]
									},
									1,
									0
								]
							}
						},
						repeating: {
							$sum: {
								$cond: [{ $and: ['$repeatInterval', { $ne: ['$repeatInterval', null] }] }, 1, 0]
							}
						}
					}
				}
			])
			.toArray();
	};

	const api = (job, state, { query: q, property, isObjectId, skip, limit }) => {
		if (!agenda) {
			return Promise.reject(new Error('Agenda instance is not ready'));
		}
		limit = parseInt(limit, 10) || 200;
		skip = parseInt(skip, 10) || 0;

		return new Promise((resolve, reject) => {
			Promise.all([
				getOverview(),
				getJobs(job, state, { query: q, property, isObjectId, skip, limit })
			])
				.then(res => {
					const apiResponse = {
						overview: res[0],
						jobs: res[1][0].filtered,
						totalPages: res[1][0].pages.totalPages
					};
					apiResponse.title = options.title || 'Agendash';
					apiResponse.currentRequest = {
						title: options.title || 'Agendash',
						job: job || 'All Jobs',
						state
					};
					return resolve(apiResponse);
				})
				.catch(err => reject(err));
		});
	};

	const requeueJobs = jobIds => {
		if (!agenda) {
			return Promise.reject(new Error('Agenda instance is not ready'));
		}
		return new Promise((resolve, reject) => {
			const { collection } = agenda.db;
			collection
				.find({ _id: { $in: jobIds.map(jobId => collection.s.pkFactory(jobId)) } })
				.toArray()
				.then(jobs => {
					if (!jobs.length) {
						return reject(new Error('Job not found!'));
					}

					jobs.forEach(job => {
						const newJob = agenda.create(job.name, job.data);
						newJob.save().catch(err => {
							return reject(err);
						});
					});

					return resolve('Jobs create successfully');
				})
				.catch(err => reject(err));
		});
	};

	const deleteJobs = jobIds => {
		if (!agenda) {
			return Promise.reject(new Error('Agenda instance is not ready'));
		}

		const { collection } = agenda.db;
		return agenda.cancel({ _id: { $in: jobIds.map(jobId => collection.s.pkFactory(jobId)) } });
	};

	const createJob = (jobName, jobSchedule, jobRepeatEvery, jobData) => {
		if (!agenda) {
			return Promise.reject(new Error('Agenda instance is not ready'));
		}

		// @TODO: Need to validate user input.
		const job = agenda.create(jobName, jobData);
		if (jobSchedule && jobRepeatEvery) {
			job.repeatAt(jobSchedule);
			job.repeatEvery(jobRepeatEvery);
		} else if (jobSchedule) {
			job.schedule(jobSchedule);
		} else if (jobRepeatEvery) {
			job.repeatEvery(jobRepeatEvery);
		} else {
			return Promise.reject(new Error('Jobs not created'));
		}

		return job.save();
	};

	return {
		api,
		requeueJobs,
		deleteJobs,
		createJob
	};
};
