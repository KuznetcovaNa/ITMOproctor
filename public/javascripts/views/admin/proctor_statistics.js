//
// Proctor statistics view
//
define([
    "i18n",
    "text!templates/admin/proctor_statistics.html",
    "views/user/viewer",
    "views/user/editor"
], function(i18n, template, UserViewer, UserEditor) {
    console.log('views/admin/proctor_statistics.js');
    var View = Backbone.View.extend({
        events: {
            "click .user-info": "doUserInfo",
            "click .user-stats": "do_user_stats"
        },
        initialize: function() {
            // Templates
            this.templates = _.parseTemplate(template);
            // Sub views
            this.view = {
                userViewer: new UserViewer(),
                userEditor: new UserEditor()
            };
        },
        exams_all_proctors: {},
            
        exams_every_proctor: [],
        stats_data: {},
        destroy: function() {
            for (var v in this.view) {
                if (this.view[v]) this.view[v].destroy();
            }
            this.remove();
        },
        render: function() {
            var self = this;
            var tpl = _.template(this.templates['main-tpl']);
            var data = {
                i18n: i18n
            };
            this.$el.html(tpl(data));
            $.parser.parse(this.$el);
            
            this.$FromDate = this.$(".date-from");
            this.$FromDate.datebox({
                value: app.now().format("DD.MM.YYYY"),
                delay: 0,
                onChange: function(date) {
                    var valid = moment(date, "DD.MM.YYYY", true).isValid();
                    if (!date || valid) self.doSearch();
                }
            });
            this.$ToDate = this.$(".date-to");
            this.$ToDate.datebox({
                value: app.now().add(1, 'days').format("DD.MM.YYYY"),
                delay: 0,
                onChange: function(date) {
                    var valid = moment(date, "DD.MM.YYYY", true).isValid();
                    if (!date || valid) self.doSearch();
                }
            });

            this.$TextSearch = this.$(".text-search");
            this.$TextSearch.searchbox({
                searcher: this.doSearch.bind(this)
            });

            this.$Grid = this.$("#users-grid");
            this.$Grid.datagrid({
                columns: [
                    [{
                        field: 'username',
                        title: i18n.t('admin.users.username'),
                        width: 100,
                        sortable: true
                    }, {
                        field: 'fullname',
                        title: i18n.t('admin.proctor_statistics.proctor'),
                        width: 200,
                        sortable: false,
                        formatter: self.formatName.bind(this)
                    }, {
                        field: 'stats_active',
                        title: i18n.t('admin.proctor_statistics.stats_status'),
                        width: 100,
                        sortable: false,
                        formatter: self.format_stats.bind(this)
                    }]
                ],
                remoteSort: false,
                pagination: true,
                pageNumber: 1,
                pageSize: 50,
                pageList: [10, 50, 100, 250, 500, 1000, 10000],
                rownumbers: true,
                ctrlSelect: true,
                url: 'admin/proctor_statistics',
                method: 'get',
                queryParams: {
                    left_date: self.getDates().from,
                    right_date: self.getDates().to,
                    role: 2
                },
                loadFilter: function(data) {
                    data = data || [];
                    var text = self.$TextSearch.textbox('getValue').trim();
                    self.stats_data = data;
                    self.calculate_exams(self.getDates().from, self.getDates().to);
                    self.init_stats_plot("#plot-all-proctors", false, i18n.t('admin.proctor_statistics.all_proctors'));
                    self.init_stats_plot("#plot-one-proctor", false, i18n.t('admin.proctor_statistics.no_proctor'));
                    if (_.isEmpty(text)) {
                        return data;
                    }
                    else {
                        var rows = _.textSearch(data.rows, text);
                        return {
                            rows: rows,
                            total: rows.length
                        };
                    }
                }
            });
            
            this.$('#users-statistics-plot').panel({
                height:400,
                noheader: true
            });

            return this;
        },
        get_exam_status: function(row){
            var status = 0;
            var now = app.now();
            if (row.rightDate) {
                var rightDate = moment(row.rightDate);
                if (rightDate <= now) status = 6;
            }
            if (row.beginDate && row.endDate) {
                var beginDate = moment(row.beginDate);
                var endDate = moment(row.endDate);
                if (beginDate > now) status = 1;
                if (endDate <= now) status = 6;
                if (beginDate <= now && endDate > now) status = 2;
                if (row.startDate) status = 3;
                if (row.resolution === true) status = 4;
                if (row.resolution === false) status = 5;
            }
            return status;
        },
        calculate_exams: function(left_date, right_date){
            var all_exams = [].concat.apply([], this.stats_data.rows.map(function(x){return x.exams}));
            this.exams_all_proctors = {
                exams_by_days: {},
                count_all_exams: 0,
                count_all_days: 0,
                all_planned: 0,
                all_not_planned: 0,
                all_awaiting: 0,
                all_running: 0,
                all_accepted: 0,
                all_interrupted: 0,
                all_missed: 0,
                avg_planned: 0,
                avg_not_planned: 0,
                avg_awaiting: 0,
                avg_running: 0,
                avg_accepted: 0,
                avg_interrupted: 0,
                avg_missed: 0
            },
            
            console.log(all_exams);
            for (var d = new Date(left_date); moment(d) <= moment(right_date); d.setDate(d.getDate() + 1)) {
                this.exams_all_proctors.exams_by_days[this.formatDate(d)] = {
                    planned: 0,
                    not_planned: 0,
                    awaiting: 0,
                    running: 0,
                    accepted: 0,
                    interrupted: 0,
                    missed: 0
                };
            }
            
            var days_count = Object.keys(this.exams_all_proctors.exams_by_days).length;
            
            for (var i=0; i<all_exams.length; i++){
                var cur = all_exams[i];
                var status = this.get_exam_status(cur);
                //console.log(status);
                this.exams_all_proctors.count_all_exams++;
                
                var valuable_date = this.formatDate(cur.startDate ? cur.startDate : (cur.beginDate ? cur.beginDate : cur.leftDate));
                
                switch(status){
                    case 0:
                        this.exams_all_proctors.all_not_planned++;
                        this.exams_all_proctors.exams_by_days[valuable_date].not_planned++;
                        break;
                    case 1:
                        this.exams_all_proctors.all_planned++;
                        this.exams_all_proctors.exams_by_days[valuable_date].planned++;
                        break;
                    case 2:
                        this.exams_all_proctors.all_awaiting++;
                        this.exams_all_proctors.exams_by_days[valuable_date].awaiting++;
                        break;
                    case 3:
                        this.exams_all_proctors.all_running++;
                        this.exams_all_proctors.exams_by_days[valuable_date].running++;
                        break;
                    case 4:
                        this.exams_all_proctors.all_accepted++;
                        this.exams_all_proctors.exams_by_days[valuable_date].accepted++;
                        break;
                    case 5:
                        this.exams_all_proctors.all_interrupted++;
                        this.exams_all_proctors.exams_by_days[valuable_date].interrupted++;
                        break;
                    case 6:
                        this.exams_all_proctors.all_missed++;
                        this.exams_all_proctors.exams_by_days[valuable_date].missed++;
                        break;
                }
            }
            this.exams_all_proctors.count_all_days = days_count;
            
            this.exams_all_proctors.avg_not_planned = this.exams_all_proctors.all_not_planned / days_count;
            this.exams_all_proctors.avg_planned     = this.exams_all_proctors.all_planned     / days_count;
            this.exams_all_proctors.avg_awaiting    = this.exams_all_proctors.all_awaiting    / days_count;
            this.exams_all_proctors.avg_running     = this.exams_all_proctors.all_running     / days_count;
            this.exams_all_proctors.avg_accepted    = this.exams_all_proctors.all_accepted    / days_count;
            this.exams_all_proctors.avg_interrupted = this.exams_all_proctors.all_interrupted / days_count;
            this.exams_all_proctors.avg_missed      = this.exams_all_proctors.all_missed      / days_count;
            
            console.log(this.exams_all_proctors);
        },
        init_stats_plot: function(plot_selector, proctor_id, title){
            $(plot_selector).empty();
            var proctor_name;
            var vis = d3.select(plot_selector)
            if (!proctor_id) {
                proctor_name =  title;
            } else {
                proctor_name = this.stats_data.rows[this.get_key_by_id(this.stats_data.rows, proctor_id)].username;
            }
            vis.append("text")
                .attr("x", 10)
                .attr("y", 20)
                .text(proctor_name);
        },
        get_key_by_id: function(obj, value){
            for (var key in obj) {
                if (obj[key]._id == value) {
                    return key;
                }
            }
            return null;
        },
        formatName: function(val, row) {
            if (!row) return;
            var data = {
                i18n: i18n,
                row: row
            };
            var tpl = _.template(this.templates['user-item-tpl']);
            return tpl(data);
        },
        format_stats: function(val, row){
            if (!row) return;
            var data = {
                i18n: i18n,
                row: row
            };
            if (row.stats_is_active) {
                var tpl = _.template(this.templates['user-stats-tpl']);
                return tpl(data);
            } else {
               return i18n.t('admin.proctor_statistics.stats_not_active'); 
            }
        },
        formatDate: function(val, row) {
            if (!val) return;
            return moment(val).format('DD.MM.YYYY');
        },
        getDates: function() {
            var fromVal = this.$FromDate.datebox('getValue');
            var toVal = this.$ToDate.datebox('getValue');
            var fromDate = fromVal ? moment(fromVal, 'DD.MM.YYYY').toJSON() : null;
            var toDate = toVal ? moment(toVal, 'DD.MM.YYYY').toJSON() : null;
            return {
                from: fromDate,
                to: toDate
            };
        },
        doSearch: function() {
            var dates = this.getDates();
            this.$Grid.datagrid('load', {
                left_date: dates.from,
                right_date: dates.to,
                role: 2
            });
        },
        doUserInfo: function(e) {
            var element = e.currentTarget;
            var userId = $(element).attr('data-id');
            this.view.userViewer.doOpen(userId);
        },
        do_user_stats: function(e) {
            var element = e.currentTarget;
            var userId = $(element).attr('data-id');
            this.init_stats_plot("#plot-one-proctor", userId);
        }
    });
    return View;
});