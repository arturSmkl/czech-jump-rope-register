<script setup>

</script>

<template>
  <div class="nav-bar">
    <div class="nav-bar-item">
      <div class="logo"></div>
      <div class="title">
        Czech Jump Rope Register
      </div>
    </div>
    <div class="nav-bar-item">

    </div>
  </div>
</template>

<style scoped>
  .nav-bar {
    display: flex;
    flex-direction: row;
    justify-content: space-between;
    align-items: center;
    height: 100px;
    padding: 20px 40px;
    background-color: var(--bg-color);
    box-shadow: 0 4px 4px var(--shadow-color);
  }
  .nav-bar-item {
    display: flex;
    flex-direction: row;
    justify-content: start;
    align-items: center;
  }
  .logo {
    background-image: url("public/logo.png");
    background-repeat: no-repeat;
    background-size: cover;
    height: 60px;
    width: 153px;
    margin-right: 40px;
  }
  .title {
    font-size: 28px;
    font-weight: 600;
  }
</style>
