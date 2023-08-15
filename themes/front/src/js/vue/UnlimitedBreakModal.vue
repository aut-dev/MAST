<template>
    <div class="modal fade" tabindex="-1" id="unlimited-break-modal">
        <div class="modal-dialog modal-dialog-centered">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title">Unlimited break</h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                </div>
                <div class="modal-body">
                    <div class="form-check form-switch">
                        <input class="form-check-input" type="checkbox" id="unlimitedBreak" name="unlimitedBreak" :checked="store.onUnlimitedBreak">
                        <label class="form-check-label" for="unlimitedBreak">I'm on a unlimited break</label>
                        <div class="form-text">All your tasks will be paused until you switch this off</div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
                    <button type="button" class="btn btn-primary" @click="submitModal">
                        Save
                    </button>
                </div>
            </div>
        </div>
    </div>
</template>

<script>

import { mapState } from 'pinia';
import { useTasksStore } from './TasksStore';

export default {
    setup() {
        const store = useTasksStore();
        return { store };
    },
    data() {
        return {
            modal: null
        }
    },
    mounted() {
        App.getBootstrap().then((bootstrap) => {
            this.modal = new bootstrap.Modal(document.getElementById('unlimited-break-modal'));
        });
    },
    methods: {
        submitModal() {
            this.store.setUnlimitedBreak(document.getElementById('unlimitedBreak').checked);
            this.modal.hide();
        }
    }
};

</script>