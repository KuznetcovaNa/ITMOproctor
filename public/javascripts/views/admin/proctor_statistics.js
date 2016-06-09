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
                    left_date: app.now().startOf('day').toJSON(),
                    right_date: app.now().startOf('day').add(1, 'days').toJSON(),
                    role: 2
                },
                loadFilter: function(data) {
                    data = data || [];
                    var text = self.$TextSearch.textbox('getValue').trim();
                    self.stats_data = data;
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
        init_stats_plot: function(plot_selector, proctor_id, title){
            $(plot_selector).empty();
            var proctor_name;
            console.log(this.stats_data);
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