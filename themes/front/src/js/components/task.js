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
        if ($elem.hasClass('timer-started')) {
            this.timerStarted = new Date().getTime() / 1000;
        }
        this.initTimerBtn();
    }

    initTimerBtn()
    {
        this.$elem.find('.js-start-timer').click((e) => {
            e.preventDefault();
            if (this.$elem.hasClass('timer-started')) {
                this.stopTimer();
            } else {
                this.startTimer();
            }
        });
    }

    stopTimer()
    {
        if (this.changingTimer) {
            return;
        }
        this.changingTimer = true;
        $.ajax({
            url: '/?action=plugin-timer/timer/stop',
            data: {
                taskId: this.id
            }
        }).done((data) => {
            this.changingTimer = false;
            this.timerStarted = 0;
            this.$elem.removeClass('timer-started');
            this.$elem.find('.js-start-timer').html(this.$elem.find('.js-start-timer').data('textstart'));
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
        $.ajax({
            url: '/?action=plugin-timer/timer/start',
            data: {
                taskId: this.id
            }
        }).done(() => {
            this.changingTimer = false;
            this.$elem.addClass('timer-started');
            if (parseFloat(this.$elem.data('progress')) < 100) {
                this.timerStarted = new Date().getTime() / 1000;
            }
            this.$elem.find('.js-start-timer').html(this.$elem.find('.js-start-timer').data('textstop'));
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
            this.tasks.refreshTasks();
        }
    }

    refresh(data)
    {
        this.$elem.attr('data-status', data.status);
        this.$elem.find('.complete-tick').hide();
        if (data.status == 'complete') {
            this.$elem.find('.complete-tick').show();
        }
        this.$elem.find('.if-active').hide();
        if (data.active) {
            this.$elem.find('.if-active').show();
            if (!this.timerStarted) {
                //Only refresh the progress if we're not polling progress already, or we'd have issues 
                //with the progress bar going back and forth slightly
                this.$elem.find('.progress-bar').css('width', data.progress + '%');
                this.$elem.data('progress', data.progress);
            }
            this.$elem.find('.next-deadline').html(data.deadline);
        }
    }
}

export { Task };