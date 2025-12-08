<script lang="ts">
  import { fade, slide, scale } from "svelte/transition";
  import { quintOut } from "svelte/easing";
  import Swal from "sweetalert2";

  let currentView: "list" | "form" = "list";
  let isEditMode = false;
  let editingId: number | null = null;


  let events = [
    {
      id: 1,
      title: "KASETSART RUN OF HEALTH",
      image:
        "https://images.unsplash.com/photo-1461896836934-ffe607ba8211?auto=format&fit=crop&w=800&q=80",
      currentParticipants: 0,
      maxParticipants: "100",
      description:
        "Join us for the biggest charity run event of the year. Promote good health and support our community",

      location: "",
      day: "",
      month: "",
      year: "",
      startTime: "",
      endTime: "",
    },
    {
      id: 2,
      title: "KASETSART RUN OF HEALTH",
      image:
        "https://images.unsplash.com/photo-1461896836934-ffe607ba8211?auto=format&fit=crop&w=800&q=80",
      currentParticipants: 0,
      maxParticipants: "100",
      description:
        "Join us for the biggest charity run event of the year. Promote good health and support our community",
      location: "",
      day: "",
      month: "",
      year: "",
      startTime: "",
      endTime: "",
    },
    {
      id: 3,
      title: "KASETSART RUN OF HEALTH",
      image:
        "https://images.unsplash.com/photo-1461896836934-ffe607ba8211?auto=format&fit=crop&w=800&q=80",
      currentParticipants: 0,
      maxParticipants: "100",
      description:
        "Join us for the biggest charity run event of the year. Promote good health and support our community",
      location: "",
      day: "",
      month: "",
      year: "",
      startTime: "",
      endTime: "",
    },
    {
      id: 4,
      title: "KASETSART RUN OF HEALTH",
      image:
        "https://images.unsplash.com/photo-1461896836934-ffe607ba8211?auto=format&fit=crop&w=800&q=80",
      currentParticipants: 0,
      maxParticipants: "100",
      description:
        "Join us for the biggest charity run event of the year. Promote good health and support our community",
      location: "",
      day: "",
      month: "",
      year: "",
      startTime: "",
      endTime: "",
    },
    {
      id: 5,
      title: "KASETSART RUN OF HEALTH",
      image:
        "https://images.unsplash.com/photo-1461896836934-ffe607ba8211?auto=format&fit=crop&w=800&q=80",
      currentParticipants: 0,
      maxParticipants: "100",
      description:
        "Join us for the biggest charity run event of the year. Promote good health and support our community",
      location: "",
      day: "",
      month: "",
      year: "",
      startTime: "",
      endTime: "",
    },
  ];

  let isMenuOpen = false;

  function toggleMenu() {
    isMenuOpen = !isMenuOpen;
  }

  function handleOverlayKeydown(event: KeyboardEvent) {
    if (event.key === "Enter" || event.key === " ") {
      toggleMenu();
    }
  }

  function handleDelete(id: number) {
    Swal.fire({
      title: "Are you sure?",
      text: "You won't be able to revert this!",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#B4151D",
      cancelButtonColor: "#6B7280",
      iconColor: "#B4151D",
      confirmButtonText: "Yes, delete it!",
      width: "320px",
      customClass: { popup: "my-swal-popup" },
    }).then((result) => {
      if (result.isConfirmed) {
        events = events.filter((e) => e.id !== id);
        Swal.fire({
          title: "Deleted!",
          icon: "success",
          width: "320px",
          confirmButtonColor: "#10B981",
          showConfirmButton: false,
          timer: 1500,
          customClass: { popup: "my-swal-popup" },
        });
      }
    });
  }


  function goToCreate() {
    resetForm();
    isEditMode = false;
    currentView = "form";
  }

  function goToEdit(id: number) {
    const event = events.find((e) => e.id === id);
    if (event) {
      eventName = event.title;
      eventDescription = event.description;
      previewImage = event.image;
      selSlots = event.maxParticipants.toString();

      eventLocation = event.location || "";
      selDay = event.day || "";
      selMonth = event.month || "";
      selYear = event.year || "";
      selStartTime = event.startTime || "";
      selEndTime = event.endTime || "";

      editingId = id;
      isEditMode = true;
      currentView = "form";
    }
  }

  function backToList() {
    currentView = "list";
    resetForm();
  }


  let eventName = "";
  let selDay = "";
  let selMonth = "";
  let selYear = "";
  let selStartTime = "";
  let selEndTime = "";
  let selSlots = "";
  let eventLocation = "";
  let eventDescription = "";
  let previewImage = "";
  let activeDropdown = "";

  let errorMessage = "";
  let successMessage = "";
  let msgTimeout: any;
  let errorField: string = "";

  const days = Array.from({ length: 31 }, (_, i) => (i + 1).toString());
  const months = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 50 }, (_, i) =>
    (currentYear + i).toString()
  );

  const times: string[] = [];
  for (let i = 0; i < 24; i++) {
    const hour = i.toString().padStart(2, "0");
    times.push(`${hour}:00`);
    times.push(`${hour}:30`);
  }

  const slotsOptions = [
    "10",
    "20",
    "30",
    "40",
    "50",
    "100",
    "200",
    "500",
    "Unlimited",
  ];

  function resetForm() {
    eventName = "";
    selDay = "";
    selMonth = "";
    selYear = "";
    selStartTime = "";
    selEndTime = "";
    selSlots = "";
    eventLocation = "";
    eventDescription = "";
    previewImage = "";
    errorMessage = "";
    successMessage = "";
    errorField = "";
  }

  function clearMessages() {
    if (errorMessage || successMessage) {
      errorMessage = "";
      successMessage = "";
      if (msgTimeout) clearTimeout(msgTimeout);
    }
  }

  function handleImageUpload() {
    clearMessages();
    previewImage =
      "https://images.unsplash.com/photo-1552674605-46f5383a6719?auto=format&fit=crop&w=600&q=80";
  }

  function toggleDropdown(name: string, event: Event) {
    event.stopPropagation();
    activeDropdown = activeDropdown === name ? "" : name;
  }

  function openDropdown(name: string) {
    activeDropdown = name;
  }

  function selectOption(type: string, value: any) {
    clearMessages();
    if (type === "day") selDay = value;
    if (type === "month") selMonth = value;
    if (type === "year") selYear = value;
    if (type === "startTime") selStartTime = value;
    if (type === "endTime") selEndTime = value;
    if (type === "slots") selSlots = value;
    activeDropdown = "";
  }

  function closeDropdowns() {
    activeDropdown = "";
  }

  function handleTimeInput(event: Event, type: "start" | "end") {
    clearMessages();
    const input = event.target as HTMLInputElement;
    let v = input.value.replace(/[^0-9]/g, "");
    if (v.length > 4) v = v.slice(0, 4);
    if (v.length > 2) v = v.slice(0, 2) + ":" + v.slice(2);
    input.value = v;
    if (type === "start") selStartTime = v;
    if (type === "end") selEndTime = v;
  }

  function handleSlotInput(event: Event) {
    clearMessages();
    const input = event.target as HTMLInputElement;
    let v = input.value.replace(/[^0-9]/g, "");
    input.value = v;
    selSlots = v;
  }

  function getSelectClass(value: any) {
    return value === "" ? "text-gray" : "text-dark";
  }

  function handlePublish() {
    if (msgTimeout) clearTimeout(msgTimeout);
    errorMessage = "";
    successMessage = "";
    errorField = "";

    if (!eventName) {
      errorField = "eventName";
      errorMessage = "Please enter the Event name.";
    } else if (!selDay) {
      errorField = "day";
      errorMessage = "Please select the Event Day.";
    } else if (!selMonth) {
      errorField = "month";
      errorMessage = "Please select the Event Month.";
    } else if (!selYear) {
      errorField = "year";
      errorMessage = "Please select the Event Year.";
    } else if (!selStartTime) {
      errorField = "startTime";
      errorMessage = "Please enter the Start time.";
    } else if (!selEndTime) {
      errorField = "endTime";
      errorMessage = "Please enter the End time.";
    } else if (!eventLocation) {
      errorField = "eventLocation";
      errorMessage = "Please enter the Event location.";
    } else if (!eventDescription) {
      errorField = "eventDescription";
      errorMessage = "Please enter the Event description.";
    } else if (!selSlots) {
      errorField = "slots";
      errorMessage = "Please enter or select the Number of slots.";
    }

    if (errorMessage) {
      msgTimeout = setTimeout(() => {
        errorMessage = "";
        errorField = "";
      }, 3000);
      return;
    }

    const eventPayload = {
      id: isEditMode && editingId ? editingId : Date.now(),
      title: eventName,
      image:
        previewImage ||
        "https://images.unsplash.com/photo-1461896836934-ffe607ba8211?auto=format&fit=crop&w=800&q=80",
      currentParticipants: 0,
      maxParticipants: selSlots,
      description: eventDescription,
      location: eventLocation,
      day: selDay,
      month: selMonth,
      year: selYear,
      startTime: selStartTime,
      endTime: selEndTime,
    };

    if (isEditMode) {
      events = events.map((e) =>
        e.id === editingId
          ? {
              ...e,
              ...eventPayload,
              currentParticipants: e.currentParticipants,
            }
          : e
      );
      successMessage = "Event updated successfully.";
    } else {
      events = [eventPayload, ...events];
      successMessage = "Event created successfully.";
    }

    msgTimeout = setTimeout(() => {
      successMessage = "";
      backToList();
    }, 1500);
  }
</script>

<svelte:window on:click={closeDropdowns} />

<div class="app-screen">
  <div class="glass-header">
    {#if currentView === "list"}
      <h1 class="page-title">CREATE EVENT</h1>
      <button
        class="menu-burger"
        class:active={isMenuOpen}
        on:click|stopPropagation={toggleMenu}
        aria-label="Toggle menu"
      >
        <span class="line line-1"></span>
        <span class="line line-2"></span>
      </button>
    {:else}
      <button class="back-btn" on:click={backToList} aria-label="Back">
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          ><line x1="19" y1="12" x2="5" y2="12"></line><polyline
            points="12 19 5 12 12 5"
          ></polyline></svg
        >
      </button>
      <h1 class="page-title">{isEditMode ? "EDIT EVENT" : "CREATE EVENT"}</h1>
    {/if}
  </div>

  {#if currentView === "list" && isMenuOpen}
    <div
      class="menu-overlay"
      role="button"
      tabindex="0"
      on:click={toggleMenu}
      on:keydown={handleOverlayKeydown}
      transition:fade={{ duration: 200 }}
    ></div>
    <div
      class="dropdown-menu"
      transition:scale={{
        duration: 250,
        start: 0.9,
        opacity: 0,
        easing: quintOut,
      }}
    >
      <div class="menu-arrow"></div>
      <a href="/officer/eventverify" class="menu-item"
        ><span class="icon">🔢</span> Verify Code</a
      >
      <a href="/officer/upload-proof" class="menu-item"
        ><span class="icon">📝</span> Verify Proof</a
      >
      <a href="/officer/monthly-reward" class="menu-item"
        ><span class="icon">🏆</span> Monthly Reward</a
      >
      <a href="/officer/setting-account" class="menu-item"
        ><span class="icon">⚙️</span> Settings</a
      >
      <div class="menu-divider"></div>
      <a href="/" class="menu-item logout"
        ><span class="icon">🚪</span> Logout</a
      >
    </div>
  {/if}

  <div class="scroll-container">
    <div class="content-wrapper">
      {#if currentView === "list"}
        <div class="event-list" in:fade>
          {#each events as event (event.id)}
            <div class="card">
              <div class="card-image">
                <img src={event.image} alt={event.title} />
              </div>
              <div class="card-content">
                <div class="card-header-row">
                  <h3 class="card-title">{event.title}</h3>
                  <div class="participant-badge">
                    <svg
                      class="users-icon"
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    >
                      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"
                      ></path><circle cx="9" cy="7" r="4"></circle><path
                        d="M23 21v-2a4 4 0 0 0-3-3.87"
                      ></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                    </svg>
                    <span
                      >{event.currentParticipants}/{event.maxParticipants}</span
                    >
                  </div>
                </div>
                <p class="card-desc">{event.description}</p>
                <div class="card-actions">
                  <button
                    class="action-btn edit-btn"
                    on:click={() => goToEdit(event.id)}>EDIT</button
                  >
                  <button
                    class="action-btn delete-btn"
                    on:click={() => handleDelete(event.id)}>DELETE</button
                  >
                </div>
              </div>
            </div>
          {/each}
        </div>

        <button class="fab-btn" on:click={goToCreate} aria-label="Create Event">
          <svg
            width="32"
            height="32"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            ><line x1="12" y1="5" x2="12" y2="19"></line><line
              x1="5"
              y1="12"
              x2="19"
              y2="12"
            ></line></svg
          >
        </button>
      {:else}
        <div class="form-card" in:slide={{ axis: "y", duration: 300 }}>
          <button
            type="button"
            class="upload-section"
            on:click={handleImageUpload}
            aria-label="Upload Event Image"
          >
            {#if previewImage}
              <img src={previewImage} alt="Preview" class="uploaded-img" />
              <div class="change-overlay">Change Image</div>
            {:else}
              <div class="upload-placeholder">
                <svg
                  class="camera-icon"
                  width="32"
                  height="32"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  ><path
                    d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"
                  ></path><circle cx="12" cy="13" r="4"></circle></svg
                >
                <span class="upload-text">Tap To Upload Image</span>
              </div>
            {/if}
          </button>
          <div class="divider"></div>

          <div class="form-group">
            <label class="form-label" for="eventName">Event Name</label>
            <input
              id="eventName"
              type="text"
              class="form-input"
              class:error-border={errorField === "eventName"}
              placeholder="Enter your event name"
              bind:value={eventName}
              on:input={clearMessages}
            />
          </div>

          <div class="form-group">
            <label class="form-label" for="daySelect">Date</label>
            <div class="date-row">
              <div class="custom-select-container" style="flex: 1;">
                <button
                  class="form-input select-trigger {getSelectClass(selDay)}"
                  class:error-border={errorField === "day"}
                  on:click={(e) => toggleDropdown("day", e)}
                >
                  {selDay || "Day"}
                  <svg
                    class="chevron-icon {activeDropdown === 'day'
                      ? 'rotate'
                      : ''}"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    ><polyline points="6 9 12 15 18 9"></polyline></svg
                  >
                </button>
                {#if activeDropdown === "day"}
                  <div
                    class="dropdown-options"
                    transition:slide={{ duration: 200 }}
                  >
                    {#each days as day}
                      <button
                        class="option-item {selDay === day ? 'selected' : ''}"
                        on:click={(e) => {
                          e.stopPropagation();
                          selectOption("day", day);
                        }}>{day}</button
                      >
                    {/each}
                  </div>
                {/if}
              </div>
              <div class="custom-select-container" style="flex: 2;">
                <button
                  class="form-input select-trigger {getSelectClass(selMonth)}"
                  class:error-border={errorField === "month"}
                  on:click={(e) => toggleDropdown("month", e)}
                >
                  {selMonth || "Month"}
                  <svg
                    class="chevron-icon {activeDropdown === 'month'
                      ? 'rotate'
                      : ''}"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    ><polyline points="6 9 12 15 18 9"></polyline></svg
                  >
                </button>
                {#if activeDropdown === "month"}
                  <div
                    class="dropdown-options"
                    transition:slide={{ duration: 200 }}
                  >
                    {#each months as month}
                      <button
                        class="option-item {selMonth === month
                          ? 'selected'
                          : ''}"
                        on:click={(e) => {
                          e.stopPropagation();
                          selectOption("month", month);
                        }}>{month}</button
                      >
                    {/each}
                  </div>
                {/if}
              </div>
              <div class="custom-select-container" style="flex: 1.5;">
                <button
                  class="form-input select-trigger {getSelectClass(selYear)}"
                  class:error-border={errorField === "year"}
                  on:click={(e) => toggleDropdown("year", e)}
                >
                  {selYear || "Year"}
                  <svg
                    class="chevron-icon {activeDropdown === 'year'
                      ? 'rotate'
                      : ''}"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    ><polyline points="6 9 12 15 18 9"></polyline></svg
                  >
                </button>
                {#if activeDropdown === "year"}
                  <div
                    class="dropdown-options"
                    transition:slide={{ duration: 200 }}
                  >
                    {#each years as year}
                      <button
                        class="option-item {selYear === year ? 'selected' : ''}"
                        on:click={(e) => {
                          e.stopPropagation();
                          selectOption("year", year);
                        }}>{year}</button
                      >
                    {/each}
                  </div>
                {/if}
              </div>
            </div>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label class="form-label" for="startTime">Start Time</label>
              <div class="custom-select-container">
                <input
                  id="startTime"
                  type="text"
                  class="form-input"
                  class:error-border={errorField === "startTime"}
                  placeholder="00:00"
                  value={selStartTime}
                  on:input={(e) => handleTimeInput(e, "start")}
                  on:click={(e) => {
                    e.stopPropagation();
                    openDropdown("startTime");
                  }}
                  maxlength="5"
                  inputmode="numeric"
                />
                <svg
                  class="chevron-icon overlay-icon"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  ><circle cx="12" cy="12" r="10"></circle><polyline
                    points="12 6 12 12 16 14"
                  ></polyline></svg
                >
                {#if activeDropdown === "startTime"}
                  <div
                    class="dropdown-options"
                    transition:slide={{ duration: 200 }}
                  >
                    {#each times as time}
                      <button
                        class="option-item {selStartTime === time
                          ? 'selected'
                          : ''}"
                        on:click={(e) => {
                          e.stopPropagation();
                          selectOption("startTime", time);
                        }}>{time}</button
                      >
                    {/each}
                  </div>
                {/if}
              </div>
            </div>
            <div class="form-group">
              <label class="form-label" for="endTime">End Time</label>
              <div class="custom-select-container">
                <input
                  id="endTime"
                  type="text"
                  class="form-input"
                  class:error-border={errorField === "endTime"}
                  placeholder="00:00"
                  value={selEndTime}
                  on:input={(e) => handleTimeInput(e, "end")}
                  on:click={(e) => {
                    e.stopPropagation();
                    openDropdown("endTime");
                  }}
                  maxlength="5"
                  inputmode="numeric"
                />
                <svg
                  class="chevron-icon overlay-icon"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  ><circle cx="12" cy="12" r="10"></circle><polyline
                    points="12 6 12 12 16 14"
                  ></polyline></svg
                >
                {#if activeDropdown === "endTime"}
                  <div
                    class="dropdown-options"
                    transition:slide={{ duration: 200 }}
                  >
                    {#each times as time}
                      <button
                        class="option-item {selEndTime === time
                          ? 'selected'
                          : ''}"
                        on:click={(e) => {
                          e.stopPropagation();
                          selectOption("endTime", time);
                        }}>{time}</button
                      >
                    {/each}
                  </div>
                {/if}
              </div>
            </div>
          </div>

          <div class="form-group">
            <label class="form-label" for="eventLocation">Location</label>
            <input
              id="eventLocation"
              type="text"
              class="form-input"
              class:error-border={errorField === "eventLocation"}
              placeholder="Enter your location"
              bind:value={eventLocation}
              on:input={clearMessages}
            />
          </div>

          <div class="form-group">
            <label class="form-label" for="eventDesc">Description</label>
            <textarea
              id="eventDesc"
              class="form-input textarea"
              class:error-border={errorField === "eventDescription"}
              placeholder="Enter your description"
              bind:value={eventDescription}
              on:input={clearMessages}
            ></textarea>
          </div>

          <div class="form-group">
            <label class="form-label" for="eventSlots">Slots</label>
            <div class="custom-select-container">
              <input
                id="eventSlots"
                type="text"
                class="form-input"
                class:error-border={errorField === "slots"}
                placeholder="Enter or select slots"
                value={selSlots}
                on:input={handleSlotInput}
                on:click={(e) => {
                  e.stopPropagation();
                  openDropdown("slots");
                }}
                inputmode="numeric"
              />
              <svg
                class="chevron-icon overlay-icon"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                ><polyline points="6 9 12 15 18 9"></polyline></svg
              >
              {#if activeDropdown === "slots"}
                <div
                  class="dropdown-options"
                  transition:slide={{ duration: 200 }}
                >
                  {#each slotsOptions as slot}
                    <button
                      class="option-item {selSlots === slot ? 'selected' : ''}"
                      on:click={(e) => {
                        e.stopPropagation();
                        selectOption("slots", slot);
                      }}>{slot}</button
                    >
                  {/each}
                </div>
              {/if}
            </div>
          </div>

          {#if errorMessage}
            <div class="message-container error" transition:slide>
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                ><circle cx="12" cy="12" r="10"></circle><line
                  x1="12"
                  y1="8"
                  x2="12"
                  y2="12"
                ></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg
              >
              <span>{errorMessage}</span>
            </div>
          {/if}
          {#if successMessage}
            <div class="message-container success" transition:slide>
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                ><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline
                  points="22 4 12 14.01 9 11.01"
                ></polyline></svg
              >
              <span>{successMessage}</span>
            </div>
          {/if}

          <button class="publish-btn" on:click={handlePublish}>
            {isEditMode ? "UPDATE EVENT" : "PUBLISH EVENT"}
          </button>
        </div>
      {/if}
    </div>
  </div>
</div>

<style>
  @import url("https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap");

  :global(body) {
    margin: 0;
    padding: 0;
    background-color: #111827;
    color: white;
    font-family: "Inter", sans-serif;
    overflow: hidden;
  }
  :global(button),
  :global(input),
  :global(textarea),
  :global(select),
  :global(h1),
  :global(h2),
  :global(h3),
  :global(h4),
  :global(h5),
  :global(h6),
  :global(p),
  :global(span),
  :global(a),
  :global(div),
  :global(label) {
    font-family: "Inter", sans-serif !important;
  }
  :global(::placeholder) {
    font-family: "Inter", sans-serif !important;
  }
  :global(.swal2-container) {
    backdrop-filter: blur(5px);
    -webkit-backdrop-filter: blur(5px);
    background: rgba(0, 0, 0, 0.5) !important;
  }
  :global(.my-swal-popup) {
    border-radius: 20px !important;
    font-family: "Inter", sans-serif !important;
  }

  .app-screen {
    height: 100vh;
    display: flex;
    flex-direction: column;
    position: relative;
  }
  .glass-header {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 80px;
    z-index: 50;
    background: rgba(17, 24, 39, 0.95);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    border-bottom: 1px solid rgba(17, 24, 39, 0.95);
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .page-title {
    color: white;
    font-size: 28px;
    font-weight: 700;
    margin: 0;
    letter-spacing: 1px;
  }
  .back-btn {
    position: absolute;
    left: 20px;
    width: 36px;
    height: 36px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.1);
    border: 1px solid rgba(255, 255, 255, 0.2);
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    cursor: pointer;
    transition: 0.2s;
  }
  .back-btn:hover {
    background: rgba(255, 255, 255, 0.2);
  }


  .scroll-container {
    flex: 1;
    overflow-y: auto;
    overflow-x: hidden;
    -webkit-overflow-scrolling: touch;
    padding-top: 100px;
    padding-bottom: 40px;
  }
  .scroll-container::-webkit-scrollbar {
    display: none;
  }
  .content-wrapper {
    width: 100%;
    max-width: 400px;
    margin: 0 auto;
    padding: 0 20px;
    box-sizing: border-box;
  }

  .event-list {
    display: flex;
    flex-direction: column;
    gap: 24px;
  }
  .card {
    background: white;
    border-radius: 20px;
    overflow: hidden;
    color: #333;
    box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
  }
  .card-image {
    height: 200px;
    width: 100%;
    position: relative;
  }
  .card-image img {
    height: 100%;
    width: 100%;
    object-fit: cover;
  }
  .card-content {
    padding: 20px;
  }
  .card-header-row {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 10px;
  }
  .card-title {
    font-size: 16px;
    font-weight: 700;
    color: #111827;
    margin: 0;
    line-height: 1.4;
    flex: 1;
    text-transform: uppercase;
    padding-right: 10px;
  }
  .participant-badge {
    display: flex;
    flex-direction: column;
    align-items: center;
    font-size: 11px;
    color: #6b7280;
    font-weight: 600;
    min-width: 40px;
  }
  .users-icon {
    color: #374151;
    margin-bottom: 2px;
  }
  .card-desc {
    font-size: 13px;
    color: #4b5563;
    line-height: 1.5;
    margin: 0 0 20px 0;
  }
  .card-actions {
    display: flex;
    gap: 12px;
  }
  .action-btn {
    flex: 1;
    padding: 10px 0;
    border-radius: 8px;
    font-size: 13px;
    font-weight: 700;
    border: none;
    cursor: pointer;
    text-transform: uppercase;
    transition: 0.2s;
  }
  .edit-btn {
    background-color: #10b981;
    color: white;
  }
  .edit-btn:hover {
    background-color: #059669;
  }
  .delete-btn {
    background-color: #b4151d;
    color: white;
  }
  .delete-btn:hover {
    background-color: #991b1b;
  }

  .fab-btn {
    position: absolute;
    bottom: 30px;
    left: 50%;
    transform: translateX(-50%);
    width: 56px;
    height: 56px;
    border-radius: 50%;
    background-color: transparent;
    border: 2px solid white;
    color: white;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    box-shadow: 0 4px 10px rgba(0, 0, 0, 0.3);
    transition: 0.2s;
    z-index: 60;
  }
  .fab-btn:active {
    transform: translateX(-50%) scale(0.95);
    background-color: rgba(255, 255, 255, 0.1);
  }
  .menu-burger {
    position: absolute;
    right: 20px;
    top: 50%;
    transform: translateY(-50%);
    width: 32px;
    height: 32px;
    background: none;
    border: none;
    cursor: pointer;
    padding: 0;
    z-index: 52;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    gap: 6px;
  }
  .line {
    display: block;
    width: 24px;
    height: 2.5px;
    background-color: white;
    border-radius: 2px;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    transform-origin: center;
  }
  .menu-burger.active .line-1 {
    transform: translateY(4.25px) rotate(45deg);
  }
  .menu-burger.active .line-2 {
    transform: translateY(-4.25px) rotate(-45deg);
  }
  .dropdown-menu {
    position: absolute;
    top: 70px;
    right: 16px;
    width: 200px;
    background: white;
    z-index: 51;
    border-radius: 16px;
    padding: 8px 0;
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.4);
    transform-origin: top right;
  }
  .menu-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.3);
    z-index: 50;
    cursor: default;
  }
  .menu-arrow {
    position: absolute;
    top: -6px;
    right: 14px;
    width: 12px;
    height: 12px;
    background: white;
    transform: rotate(45deg);
    border-top-left-radius: 4px;
  }
  .menu-item {
    display: flex;
    align-items: center;
    padding: 10px 16px;
    text-decoration: none;
    color: #374151;
    font-weight: 500;
    font-size: 15px;
    border: none;
    background: none;
    cursor: pointer;
    width: auto;
    margin: 4px 8px;
    border-radius: 8px;
    transition: all 0.2s;
  }
  .menu-item:hover {
    background-color: #f3f4f6;
    color: #10b981;
    transform: translateX(4px);
  }
  .icon {
    margin-right: 12px;
    font-size: 18px;
  }
  .menu-item.logout {
    color: #ef4444;
  }
  .menu-item.logout:hover {
    background-color: #fef2f2;
    color: #b40808;
  }
  .menu-divider {
    height: 1px;
    background: #e5e7eb;
    margin: 6px 12px;
  }

  .form-card {
    background: white;
    border-radius: 20px;
    padding: 30px 24px;
    color: #111827;
  }
  .upload-section {
    width: 100%;
    height: 120px;
    display: flex;
    justify-content: center;
    align-items: center;
    margin-bottom: 20px;
    cursor: pointer;
    position: relative;
    border-radius: 12px;
    overflow: hidden;
    background: transparent;
    border: 1px dashed #9ca3af;
    padding: 0;
    font-family: inherit;
  }
  .upload-section:hover {
    background-color: #f9fafb;
  }
  .upload-placeholder {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    color: #111827;
  }
  .upload-text {
    font-size: 12px;
    color: #6b7280;
    font-weight: 500;
  }
  .camera-icon {
    color: #111827;
  }
  .uploaded-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    border: none;
  }
  .change-overlay {
    position: absolute;
    bottom: 0;
    width: 100%;
    background: rgba(0, 0, 0, 0.5);
    color: white;
    font-size: 10px;
    text-align: center;
    padding: 4px;
  }
  .divider {
    height: 1px;
    background-color: #e5e7eb;
    width: 60%;
    margin: 0 auto 24px auto;
  }

  .form-group {
    margin-bottom: 16px;
  }
  .form-row {
    display: flex;
    gap: 12px;
  }
  .form-row .form-group {
    flex: 1;
  }
  .date-row {
    display: flex;
    gap: 8px;
    width: 100%;
  }
  .form-label {
    display: block;
    font-size: 14px;
    font-weight: 600;
    color: #374151;
    margin-bottom: 8px;
  }
  .form-input {
    width: 100%;
    padding: 10px 12px;
    border: 2px solid #9ca3af;
    border-radius: 8px;
    font-size: 14px;
    font-family: "Inter", sans-serif;
    color: #111827;
    box-sizing: border-box;
    outline: none;
    transition: 0.2s;
    background-color: white;
  }
  .form-input:focus {
    border-color: #10b981;
  }
  .form-input::placeholder {
    color: #9ca3af;
  }
  .textarea {
    resize: vertical;
    min-height: 80px;
  }
  .error-border {
    border-color: #ef4444 !important;
    box-shadow: 0 0 0 4px rgba(239, 68, 68, 0.25) !important;
  }

  .custom-select-container {
    position: relative;
  }
  .select-trigger {
    text-align: left;
    cursor: pointer;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .dropdown-options {
    position: absolute;
    top: calc(100% + 5px);
    left: 0;
    width: 100%;
    max-height: 200px;
    overflow-y: auto;
    background: white;
    border-radius: 8px;
    box-shadow: 0 4px 15px rgba(0, 0, 0, 0.15);
    border: 1px solid #e5e7eb;
    z-index: 100;
  }
  .dropdown-options::-webkit-scrollbar {
    width: 6px;
  }
  .dropdown-options::-webkit-scrollbar-thumb {
    background-color: #d1d5db;
    border-radius: 10px;
  }
  .option-item {
    display: block;
    width: 100%;
    padding: 10px 12px;
    text-align: left;
    background: white;
    border: none;
    font-size: 14px;
    color: #374151;
    cursor: pointer;
    transition: 0.1s;
  }
  .option-item:hover {
    background-color: #f3f4f6;
  }
  .option-item.selected {
    background-color: #ecfdf5;
    color: #10b981;
    font-weight: 600;
  }
  .text-gray {
    color: #9ca3af;
  }
  .text-dark {
    color: #111827;
  }
  .chevron-icon {
    color: #6b7280;
    pointer-events: none;
    transition: transform 0.2s;
  }
  .chevron-icon.rotate {
    transform: rotate(180deg);
  }
  .overlay-icon {
    position: absolute;
    right: 12px;
    top: 50%;
    transform: translateY(-50%);
  }

  .message-container {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 10px 14px;
    border-radius: 8px;
    margin-top: 15px;
    margin-bottom: 5px;
    font-size: 13px;
    font-weight: 600;
    gap: 10px;
    text-align: center;
    width: 100%;
    box-sizing: border-box;
  }
  .message-container.error {
    background-color: #fef2f2;
    border: 1px solid #fecaca;
    color: #b91c1c;
  }
  .message-container.success {
    background-color: #ecfdf5;
    border: 1px solid #a7f3d0;
    color: #047857;
  }

  .publish-btn {
    width: 100%;
    background-color: #10b981;
    color: white;
    border: none;
    padding: 12px 0;
    border-radius: 8px;
    font-size: 14px;
    font-weight: 700;
    cursor: pointer;
    margin-top: 15px;
    text-transform: uppercase;
    transition: 0.2s;
    font-family: "Inter", sans-serif;
  }
  .publish-btn:hover {
    background-color: #059669;
  }
</style>
