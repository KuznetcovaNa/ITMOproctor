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
        stats_data: {},
        initialize: function() {
            // Templates
            this.templates = _.parseTemplate(template);
            // Sub views
            this.view = {
                userViewer: new UserViewer(),
                userEditor: new UserEditor()
            };
        },
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
                    self.init_plot_all_proctors("#part-all-proctors", i18n.t('admin.proctor_statistics.all_proctors'));
                    self.init_plot_one_proctor("#part-one-proctor", false, i18n.t('admin.proctor_statistics.no_proctor'));
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
                height:600,
                noheader: true
            });

            return this;
        },
        //получение статуса экзамена по его полям
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
        //получение объекта с данными статистики для конкретного проктора
        calculate_exams_for_proctor: function(left_date, right_date, proctor_id){
            var all_exams = [];
            for (var i = 0; i < this.stats_data.rows.length; i++) {
                if(this.stats_data.rows[i]._id == proctor_id){
                    all_exams = this.stats_data.rows[i].exams;
                    break;
                }
            }
            return this.calculate_exams_by_list(left_date, right_date, all_exams);
        },
        //получение объекта с данными статистики для всех прокторов
        calculate_exams_for_all: function(left_date, right_date){
            var all_exams = [].concat.apply([], this.stats_data.rows.map(function(x){return x.exams}));
            return this.calculate_exams_by_list(left_date, right_date, all_exams);
        },
        //создание объекта с данными статистики по списку экзаменов
        calculate_exams_by_list: function(left_date, right_date, all_exams){
            var temp_stats = {
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
                avg_all_exams: 0,
                avg_planned: 0,
                avg_not_planned: 0,
                avg_awaiting: 0,
                avg_running: 0,
                avg_accepted: 0,
                avg_interrupted: 0,
                avg_missed: 0
            };
            
            for (var d = new Date(left_date); moment(d) <= moment(right_date); d.setDate(d.getDate() + 1)) {
                temp_stats.exams_by_days[this.formatDate(d)] = {
                    planned: 0,
                    not_planned: 0,
                    awaiting: 0,
                    running: 0,
                    accepted: 0,
                    interrupted: 0,
                    missed: 0
                };
            }
            var days_count = Object.keys(temp_stats.exams_by_days).length;
            
            for (var i=0; i<all_exams.length; i++){
                var cur = all_exams[i];
                var status = this.get_exam_status(cur);
                temp_stats.count_all_exams++;
                
                var valuable_date = this.formatDate(cur.startDate ? cur.startDate : (cur.beginDate ? cur.beginDate : cur.leftDate));
                
                switch(status){
                    case 0:
                        temp_stats.all_not_planned++;
                        temp_stats.exams_by_days[valuable_date].not_planned++;
                        break;
                    case 1:
                        temp_stats.all_planned++;
                        temp_stats.exams_by_days[valuable_date].planned++;
                        break;
                    case 2:
                        temp_stats.all_awaiting++;
                        temp_stats.exams_by_days[valuable_date].awaiting++;
                        break;
                    case 3:
                        temp_stats.all_running++;
                        temp_stats.exams_by_days[valuable_date].running++;
                        break;
                    case 4:
                        temp_stats.all_accepted++;
                        temp_stats.exams_by_days[valuable_date].accepted++;
                        break;
                    case 5:
                        temp_stats.all_interrupted++;
                        temp_stats.exams_by_days[valuable_date].interrupted++;
                        break;
                    case 6:
                        temp_stats.all_missed++;
                        temp_stats.exams_by_days[valuable_date].missed++;
                        break;
                }
            }
            temp_stats.count_all_days  = days_count;
            temp_stats.avg_all_exams = Math.round((temp_stats.count_all_exams / days_count)*100)/100;
            temp_stats.avg_not_planned = Math.round((temp_stats.all_not_planned / days_count)*100)/100;
            temp_stats.avg_planned     = Math.round((temp_stats.all_planned     / days_count)*100)/100;
            temp_stats.avg_awaiting    = Math.round((temp_stats.all_awaiting    / days_count)*100)/100;
            temp_stats.avg_running     = Math.round((temp_stats.all_running     / days_count)*100)/100;
            temp_stats.avg_accepted    = Math.round((temp_stats.all_accepted    / days_count)*100)/100;
            temp_stats.avg_interrupted = Math.round((temp_stats.all_interrupted / days_count)*100)/100;
            temp_stats.avg_missed      = Math.round((temp_stats.all_missed      / days_count)*100)/100;
            return temp_stats;
        },
        //заполнение области со статистикой для всех прокторов
        init_plot_all_proctors: function(part_selector, title){
            $(part_selector).empty();
            var stats = this.calculate_exams_for_all(this.getDates().from, this.getDates().to);
            var proctor_name = title;
            this.fill_plot_area(part_selector, stats, proctor_name);
        },
        //заполнение области со статистикой, используется библиотека D3.js
        fill_plot_area: function(part_selector, stats, proctor_name){
            var z = d3.scale.category10();
            var div = d3.select(part_selector);
            div.append("div")
                .html('<h1 style="font-size: 16px;">' + proctor_name + '</h1>' + 
                '<h2>'+ i18n.t('admin.proctor_statistics.exams_title') +'</h2>' + stats.count_all_exams + i18n.t('admin.proctor_statistics.all_title')
                + '<span style="color: '  + z(5) + ';">' + stats.all_planned + i18n.t('admin.proctor_statistics.planned_title') + '</span>'
                + '<span style="color: '  + z(4) + ';">'+ stats.all_not_planned + i18n.t('admin.proctor_statistics.not_planned_title') + '</span>'
                + '<span style="color: '  + z(1) + ';">'+ stats.all_awaiting + i18n.t('admin.proctor_statistics.awaiting_title') + '</span>'
                + '<span style="color: '  + z(6) + ';">'+ stats.all_running + i18n.t('admin.proctor_statistics.running_title') + '</span>'
                + '<span style="color: '  + z(0) + ';">'+ stats.all_accepted + i18n.t('admin.proctor_statistics.accepted_title') + '</span>'
                + '<span style="color: '  + z(2) + ';">'+ stats.all_interrupted + i18n.t('admin.proctor_statistics.interrupted_title') + '</span>'
                + '<span style="color: '  + z(3) + ';">'+ stats.all_missed + i18n.t('admin.proctor_statistics.missed_title') + '</span>' +
                '<h2>'+ i18n.t('admin.proctor_statistics.avg_numbers') +'</h2>' + stats.avg_all_exams + i18n.t('admin.proctor_statistics.exams_per_day')
                + ', <span style="color: '  + z(5) + ';">' + stats.avg_planned + i18n.t('admin.proctor_statistics.exams_per_day') + ', </span>'
                + '<span style="color: '  + z(4) + ';">'+ stats.avg_not_planned + i18n.t('admin.proctor_statistics.exams_per_day') + ', </span>'
                + '<span style="color: '  + z(1) + ';">'+ stats.avg_awaiting + i18n.t('admin.proctor_statistics.exams_per_day') + ', </span>'
                + '<span style="color: '  + z(6) + ';">'+ stats.avg_running + i18n.t('admin.proctor_statistics.exams_per_day') + ', </span>'
                + '<span style="color: '  + z(0) + ';">'+ stats.avg_accepted + i18n.t('admin.proctor_statistics.exams_per_day') + ', </span>'
                + '<span style="color: '  + z(2) + ';">'+ stats.avg_interrupted + i18n.t('admin.proctor_statistics.exams_per_day') + ', </span>'
                + '<span style="color: '  + z(3) + ';">'+ stats.avg_missed + i18n.t('admin.proctor_statistics.exams_per_day') + '.</span>');
            var causes = ["accepted", "awaiting", "interrupted", 'missed', "not_planned", "planned", "running"];

            var margin = {top: 30, right: 30, bottom: 80, left: 60},
                    width = 650 - margin.left - margin.right,
                    height = 400 - margin.top - margin.bottom;
        
            var x = d3.scale.ordinal()
                    .rangeRoundBands([0, width]);
        
            var y = d3.scale.linear()
                    .rangeRound([height, 0]);
            var xAxis = d3.svg.axis()
                    .scale(x);
        
            var yAxis = d3.svg.axis()
                    .scale(y)
                    .orient("left");
        
            var svg = d3.select(part_selector).append("svg")
                    .attr("width", width + margin.left + margin.right)
                    .attr("height", height + margin.top + margin.bottom)
                    .append("g")
                    .attr("transform", "translate(" + margin.left + "," + margin.top + ")");
        
            var layers = d3.layout.stack()(causes.map(function(c) {
                return Object.keys(stats.exams_by_days).map(
                        function(key) {
                            return {x: key, y: stats.exams_by_days[key][c]};
                        });
            }));
        
            x.domain(layers[0].map(function(d) { return d.x; }));
            y.domain([0, d3.max(layers[layers.length - 1], function(d) { return d.y0 + d.y; })]).nice();
        
            var layer = svg.selectAll(".layer")
                    .data(layers)
                    .enter().append("g")
                    .attr("class", "layer")
                    .style("fill", function(d, i) {return z(i); });
        
            layer.selectAll("rect")
                    .data(function(d) { return d; })
                    .enter().append("rect")
                    .attr("x", function(d) { return x(d.x); })
                    .attr("y", function(d) { return y(d.y + d.y0); })
                    .attr("height", function(d) { return y(d.y0) - y(d.y + d.y0); })
                    .attr("width", x.rangeBand() - 1);
        
            svg.append("g")
                    .attr("class", "axis axis--x")
                    .attr("transform", "translate(0," + height + ")")
                    .call(xAxis)
                    .selectAll("text")
                    .attr("y", 0)
                    .attr("x", 9)
                    .attr("dy", ".35em")
                    .attr("transform", "rotate(90)")
                    .style("text-anchor", "start");
        
            svg.append("g")
                    .attr("class", "axis axis--y")
                    .call(yAxis);
        },
        //заполнение области статистики для конкретного проктора
        init_plot_one_proctor: function(part_selector, proctor_id, title){
            $(part_selector).empty();
            var proctor_name = title;
            var user_stats;
            if (proctor_id) {
                proctor_name = this.stats_data.rows[this.get_key_by_id(this.stats_data.rows, proctor_id)].username;
                user_stats = this.calculate_exams_for_proctor(this.getDates().from, this.getDates().to, proctor_id);
                this.fill_plot_area(part_selector, user_stats, proctor_name);
            } else {
                var div = d3.select(part_selector);
                div.append("h3")
                    .html(proctor_name);
            }
        },
        //получение ключа по идентификатору 
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
        //заполнение поля со ссылкой на статистику проктора
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
        //отображение статистики по проктору
        do_user_stats: function(e) {
            var element = e.currentTarget;
            var userId = $(element).attr('data-id');
            this.init_plot_one_proctor("#part-one-proctor", userId);
        }
    });
    return View;
});