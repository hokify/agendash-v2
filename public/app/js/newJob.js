// eslint-disable-next-line no-unused-vars
const newJob = Vue.component('new-job', {
	data: () => ({
		jobName: '',
		jobSchedule: '',
		jobRepeatEvery: '',
		jobData: `{ "name": "Your medatada goes here..." }`
	}),
	props: ['job'],
	methods: {
		clear() {
			this.jobName = '';
			this.jobSchedule = '';
			this.jobRepeatEvery = '';
			this.jobData = '';
		},
		create() {
			const url = `api/jobs/create`;
			const body = {
				jobName: this.jobName,
				jobSchedule: this.jobSchedule,
				jobRepeatEvery: this.jobRepeatEvery,
				jobData: JSON.parse(this.jobData)
			};
			return axios
				.post(url, body)
				.then(result => result.data)
				.then(() => {
					this.$emit('popup-message');
					this.$emit('refresh-data');
					this.clear();
				})
				.catch(console.log);
		}
	},
	template: `
  <div class="modal fade" id="modalNewJob" tabindex="-1" role="dialog" aria-labelledby="exampleModalLabel" aria-hidden="true">
      <!-- Modal -->
    <div class="modal-dialog" role="document">
      <div class="modal-content">
        <div class="modal-header">
          <h5 class="modal-title" id="exampleModalLabel">Create Job</h5>
          <button type="button" class="close" data-dismiss="modal" aria-label="Close">
            <span aria-hidden="true">&times;</span>
          </button>
        </div>
        <div class="modal-body">
            <form>
              <div class="form-group">
                <label for="jobname">Job Name</label>
                <input v-model="jobName"  type="text" class="form-control" id="jobname" aria-describedby="jobname">
              </div>
              <div class="form-group">
                <label for="jobSchedule">Job Schedule</label>
                <input v-model="jobSchedule" type="text" class="form-control" id="jobSchedule" aria-describedby="jobSchedule">
                <small id="jobSchedule" class="form-text text-muted">Number/Every Unit i.e: "1 seconds" or "3 days" (check npmjs.com/human-interval)</small>
              </div>
              <div class="form-group">
                <label for="jobRepeatEvery">Job Repeat Every</label>
                <input v-model="jobRepeatEvery"  type="text" class="form-control" id="jobRepeatEvery" aria-describedby="jobRepeatEvery">
                <small id="jobRepeatEvery" class="form-text text-muted">Number/Every Unit i.e: "1 month" or "3 hours"</small>
              </div>
              <div class="form-group">
                <label for="jobData">Job Metadata</label>
                <prism-editor class="json-editor" :lineNumbers="true" v-model="jobData" language="json"></prism-editor>
              </div>
            </form>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-info" data-dismiss="modal" @click="create()">Create Job</button>
          <button type="button" class="btn btn-secondary" data-dismiss="modal">Cancel</button>
        </div>
      </div>
    </div>
  </div>
  `
});
