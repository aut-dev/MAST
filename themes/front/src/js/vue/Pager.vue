<template>
  <nav
    aria-label="Page navigation"
    class="mt-3 mt-md-4 mt-xl-5 mt-xxl-6"
    v-if="pages.length > 1"
  >
    <ul
      class="pagination text-center align-items-center justify-content-center"
    >
      <li
        :class="{ 'page-item': true, disabled: currentPage == 1 }"
        v-if="showArrows"
      >
        <a
          class="page-link"
          @click.prevent="$emit('on-page-changed', { page: 1 })"
          href="#"
          ><i class="fa-solid fa-arrow-left"></i
        ></a>
      </li>
      <li
        :class="{ 'page-item': true, active: currentPage == page }"
        v-for="page in pages"
      >
        <a
          class="page-link"
          @click.prevent="$emit('on-page-changed', { page: page })"
          href="#"
          >{{ page }}</a
        >
      </li>
      <li
        :class="{ 'page-item': true, disabled: currentPage == totalPages }"
        v-if="showArrows"
      >
        <a
          class="page-link"
          @click.prevent="$emit('on-page-changed', { page: totalPages })"
          href="#"
          ><i class="fa-solid fa-arrow-right"></i
        ></a>
      </li>
    </ul>
  </nav>
</template>

<script>
export default {
  props: {
    currentPage: Number,
    totalPages: Number,
    pagesEachWay: {
      type: Number,
      default: 3,
    },
  },
  computed: {
    pages: function () {
      let startPage = this.currentPage - this.pagesEachWay;
      let endPage = this.currentPage + this.pagesEachWay;
      if (startPage < 1) {
        let offset = startPage * -1 + 1;
        while (offset > 0 && endPage < this.totalPages) {
          endPage++;
          offset--;
        }
        startPage = 1;
      }
      if (endPage > this.totalPages) {
        let offset = endPage - this.totalPages;
        while (offset > 0 && startPage > 1) {
          startPage--;
          offset--;
        }
        endPage = this.totalPages;
      }
      let pages = [];
      while (startPage <= endPage) {
        pages.push(startPage);
        startPage++;
      }
      return pages;
    },
    showArrows: function () {
      return this.totalPages > this.pagesEachWay * 2 + 1;
    },
  },
};
</script>
