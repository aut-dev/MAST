/* globals $ */

class Task
{
    tasks;
    $elem;
    id;
    timerStarted = 0;
    changingTimer = false;
    pausing = false;
    doning = false;

    constructor(tasks, $elem)
    {
        this.tasks = tasks;
        this.$elem = $elem;
        this.$startTimer = this.$elem.find('.js-start-timer');
        this.$pause = this.$elem.find('.js-pause');
        this.id = $elem.data('id');
        if (this.timerIsStarted) {
            this.timerStarted = new Date().getTime() / 1000;
        }
        this.initTimerBtn();
        this.initPause();
        this.initDone();
        setInterval(() => this.updateProgress(), 1000);
    }

    get progressPerSec()
    {
        return parseFloat(this.$elem.data('persec'));
    }

    set status(status)
    {
        this.$elem.attr('data-status', status);
        this.$elem.find('.js-task-done').removeClass('done');
        if (status == 'complete') {
            this.$elem.find('.js-task-done').addClass('done');
        }
    }

    set active(active)
    {
        this.$elem.attr('data-active', active ? 1 : 0);
    }

    set backgroundColor(color)
    {
        this.$elem.css('background-color', color ? color : 'unset');
    }

    get timerIsStarted()
    {
        return this.$elem.data('timer-started');
    }

    set timerIsStarted(started)
    {
        this.$elem.data('timer-started', started ? 1 : 0).attr('data-timer-started', started ? 1 : 0);
        if (started) {
            this.$startTimer.html(this.$startTimer.data('textstop'));
        } else {
            this.$startTimer.html(this.$startTimer.data('textstart'));
        }
    }

    set countdown(countdown)
    {
        this.$elem.find('.countdown').html(countdown);
    }

    get progress()
    {
        return parseFloat(this.$elem.data('progress'));
    }

    get paused()
    {
        return this.$elem.data('paused');
    }

    set paused(paused)
    {
        this.$elem.data('paused', paused ? 1 : 0);
        if (paused) {
            this.$elem.find('.fa-pause').removeClass('text-body');
        } else {
            this.$elem.find('.fa-pause').addClass('text-body');
        }
    }

    set done(done)
    {
        if (done) {
            this.$elem.find('.js-task-done').addClass('done');
        } else {
            this.$elem.find('.js-task-done').removeClass('done');
        }
    }

    get done()
    {
        return this.$elem.find('.js-task-done').hasClass('done');
    }

    setProgress(progress, updateData = false)
    {
        this.$elem.find('.progress-bar').css('width', progress + '%');
        if (updateData) {
            this.$elem.data('progress', progress);
        }
    }

    initDone()
    {
        this.$elem.find('.js-task-done').click((e) => {
            e.preventDefault();
            if (this.doning) {
                return;
            }
            this.doning = true;
            $.ajax({
                url: '/?action=plugin-tasks/tasks/done',
                dataType: 'json',
                data: {
                    id: this.id,
                    done: this.done ? 0 : 1
                }
            }).done(data => {
                this.refresh(data);
                this.doning = false;
            });
        });
    }

    initPause()
    {
        this.$pause.click((e) => {
            e.preventDefault();
            this.pause(!this.paused);
        });
    }

    initTimerBtn()
    {
        this.$startTimer.click((e) => {
            e.preventDefault();
            if (this.timerIsStarted) {
                this.stopTimer();
            } else {
                this.startTimer();
            }
        });
    }

    pause(paused)
    {
        if (this.pausing) {
            return;
        }
        this.pausing = true;
        this.paused = paused;
        if (paused) {
            this.status = 'paused';
        }
        $.ajax({
            url: '/?action=plugin-tasks/tasks/pause',
            dataType: 'json',
            data: {
                id: this.id,
                paused: paused ? 1 : 0
            }
        }).done((data) => {
            this.refresh(data);
            this.pausing = false;
        });
    }

    stopTimer()
    {
        if (this.changingTimer) {
            return;
        }
        this.changingTimer = true;
        this.timerIsStarted = false;
        $.ajax({
            url: '/?action=plugin-timer/timer/stop',
            data: {
                taskId: this.id
            }
        }).done((data) => {
            this.changingTimer = false;
            this.timerStarted = 0;
            this.setProgress(data.progress, true);
        });
    }

    startTimer()
    {
        if (this.changingTimer) {
            return;
        }
        this.changingTimer = true;
        this.timerIsStarted = true;
        $.ajax({
            url: '/?action=plugin-timer/timer/start',
            data: {
                taskId: this.id
            }
        }).done(() => {
            this.changingTimer = false;
            if (this.progress < 100) {
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
        let progress = this.progress + (this.progressPerSec * elapsed);
        this.setProgress(progress);
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
            this.refresh(data[this.id]);
        });
    }

    refresh(data)
    {
        this.status = data.status;
        this.active = data.active;
        this.timerIsStarted = data.timerStarted;
        this.countdown = data.countdown;
        this.backgroundColor = data.backgroundColor;
        if (this.tasks.inactiveTasksAreHidden() && data.status == 'inactive') {
            this.$elem.closest('.task-col').hide();
        } else {
            this.$elem.closest('.task-col').show();
        }
        if (data.active && !this.timerStarted) {
            //Only refresh the progress if we're not polling progress already, or we'd have issues 
            //with the progress bar going back and forth slightly
            this.setProgress(data.progress, true);
        }
    }
}

export { Task };