/* globals $ */

class Task
{
    tasks;
    $elem;
    id;
    timerStarted = 0;
    progressPerSec = 0;
    changingTimer = false;

    constructor(tasks, $elem)
    {
        this.tasks = tasks;
        this.$elem = $elem;
        this.id = $elem.data('id');
        this.progressPerSec = parseFloat(this.$elem.data('persec'));
        if ($elem.data('timer-started')) {
            this.timerStarted = new Date().getTime() / 1000;
        }
        $elem.click(e => {
            if (!$(e.target).hasClass('stop-click')) {
                window.location.href = this.$elem.data('url');
            }
        });
        this.initTimerBtn();
        this.initPause();
    }

    initPause()
    {
        let $pause = this.$elem.find('.js-pause');
        $pause.change(() => {
            this.pause($pause.is(':checked'));
        });
    }

    initTimerBtn()
    {
        this.$elem.find('.js-start-timer').click((e) => {
            e.preventDefault();
            if (this.$elem.data('timer-started')) {
                this.stopTimer();
            } else {
                this.startTimer();
            }
        });
    }

    pause(paused)
    {
        $.ajax({
            url: '/?action=plugin-tasks/tasks/pause',
            dataType: 'json',
            data: {
                id: this.id,
                paused: paused ? 1 : 0
            }
        }).done((data) => {
            this.refresh(data);
        });
    }

    stopTimer()
    {
        if (this.changingTimer) {
            return;
        }
        this.changingTimer = true;
        this.$elem.find('.js-start-timer').html(this.$elem.find('.js-start-timer').data('textstart'));
        this.$elem.data('timer-started', 0).attr('data-timer-started', 0);
        $.ajax({
            url: '/?action=plugin-timer/timer/stop',
            data: {
                taskId: this.id
            }
        }).done((data) => {
            this.changingTimer = false;
            this.timerStarted = 0;
            this.$elem.find('.progress-bar').css('width', data.progress + '%');
            this.$elem.data('progress', data.progress);
        });
    }

    startTimer()
    {
        if (this.changingTimer) {
            return;
        }
        this.changingTimer = true;
        this.$elem.find('.js-start-timer').html(this.$elem.find('.js-start-timer').data('textstop'));
        this.$elem.data('timer-started', 1).attr('data-timer-started', 1);
        $.ajax({
            url: '/?action=plugin-timer/timer/start',
            data: {
                taskId: this.id
            }
        }).done(() => {
            this.changingTimer = false;
            if (parseFloat(this.$elem.data('progress')) < 100) {
                this.timerStarted = new Date().getTime() / 1000;
            }
        });
    }

    updateProgress()
    {
        if (!this.timerStarted) {
            return;
        }
        let elapsed = (new Date().getTime() / 1000) - this.timerStarted;
        let progress = parseFloat(this.$elem.data('progress')) + (this.progressPerSec * elapsed);
        this.$elem.find('.progress-bar').css('width', progress + '%');
        if (progress > 100) {
            this.timerStarted = 0;
            this.refreshTask();
        }
    }

    refreshTask()
    {
        if (this.tasks.refreshing) {
            return false;
        }
        this.tasks.refreshing = true;
        $.ajax({
            url: '/?action=plugin-tasks/tasks/poll',
            data: {
                id: this.id
            }
        }).done((data) => {
            this.tasks.refreshing = false;
            this.refresh(data.id);
        });
    }

    refresh(data)
    {
        this.$elem.attr('data-status', data.status);
        this.$elem.attr('data-active', data.active ? 1 : 0);
        this.$elem.data('timer-started', data.timerStarted ? 1 : 0).attr('data-timer-started', data.timerStarted ? 1 : 0);
        if (data.active) {
            if (!this.timerStarted) {
                //Only refresh the progress if we're not polling progress already, or we'd have issues 
                //with the progress bar going back and forth slightly
                this.$elem.find('.progress-bar').css('width', data.progress + '%');
                this.$elem.data('progress', data.progress);
            }
            this.$elem.find('.countdown').html(data.countdown);
        }
        this.$elem.find('.js-start-timer').html(this.$elem.find('.js-start-timer').data('textstart'));
        if (data.timerStarted) {
            this.$elem.find('.js-start-timer').html(this.$elem.find('.js-start-timer').data('textstop'));
        }
    }
}

export { Task };