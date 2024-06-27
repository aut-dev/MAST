<template>
  <div class="modal fade" tabindex="-1" id="delete-break-modal">
    <div class="modal-dialog modal-dialog-centered">
      <div class="modal-content">
        <form>
          <div class="modal-header">
            <h5 class="modal-title">{{ t("Delete break") }}</h5>
            <button
              type="button"
              class="btn-close"
              data-bs-dismiss="modal"
              :aria-label="t('Close')"
            ></button>
          </div>
          <div class="modal-body">
            <p>{{ t("This will delete the break, are you sure ?") }}</p>
          </div>
          <div class="modal-footer">
            <button
              type="button"
              class="btn btn-secondary"
              data-bs-dismiss="modal"
            >
              {{ t("Close") }}
            </button>
            <button type="button" class="btn btn-primary" @click="submitModal">
              <span
                class="spinner-border spinner-border-sm"
                role="status"
                aria-hidden="true"
                v-if="submitting"
              ></span>
              {{ t("Delete") }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script>
import axios from "axios";

export default {
  props: {
    breakId: Number,
  },
  data() {
    return {
      submitting: false,
    };
  },
  mounted() {
    App.getBootstrap().then((bootstrap) => {
      this.modal = new bootstrap.Modal(
        document.getElementById("delete-break-modal"),
      );
    });
  },
  methods: {
    submitModal() {
      this.submitting = true;
      axios
        .post(
          "/",
          {
            action: "elements/delete",
            elementId: this.breakId,
          },
          {
            headers: {
              "X-CSRF-Token": Craft.csrfToken,
              "Content-Type": "application/x-www-form-urlencoded",
            },
          },
        )
        .then(() => {
          App.addToast(this.t("Break deleted"));
          this.submitting = false;
          this.$emit("breakDeleted", { id: this.breakId });
          this.modal.hide();
        })
        .catch(() => {
          App.addToast(this.t("Could not delete break"), "danger");
          this.submitting = false;
        });
    },
  },
};
</script>
