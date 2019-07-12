import { Component, OnInit } from '@angular/core'
import { PluginType } from '@shared/models/plugins/plugin.type'
import { I18n } from '@ngx-translate/i18n-polyfill'
import { PluginApiService } from '@app/+admin/plugins/shared/plugin-api.service'
import { ComponentPagination, hasMoreItems } from '@app/shared/rest/component-pagination.model'
import { ConfirmService, Notifier } from '@app/core'
import { PeerTubePlugin } from '@shared/models/plugins/peertube-plugin.model'
import { ActivatedRoute, Router } from '@angular/router'
import { compareSemVer } from '@app/shared/misc/utils'

@Component({
  selector: 'my-plugin-list-installed',
  templateUrl: './plugin-list-installed.component.html',
  styleUrls: [
    '../shared/toggle-plugin-type.scss',
    './plugin-list-installed.component.scss'
  ]
})
export class PluginListInstalledComponent implements OnInit {
  pluginTypeOptions: { label: string, value: PluginType }[] = []
  pluginType: PluginType = PluginType.PLUGIN

  pagination: ComponentPagination = {
    currentPage: 1,
    itemsPerPage: 10
  }
  sort = 'name'

  plugins: PeerTubePlugin[] = []
  updating: { [name: string]: boolean } = {}

  PluginType = PluginType

  constructor (
    private i18n: I18n,
    private pluginService: PluginApiService,
    private notifier: Notifier,
    private confirmService: ConfirmService,
    private router: Router,
    private route: ActivatedRoute
  ) {
    this.pluginTypeOptions = this.pluginService.getPluginTypeOptions()
  }

  ngOnInit () {
    const query = this.route.snapshot.queryParams
    if (query['pluginType']) this.pluginType = parseInt(query['pluginType'], 10)

    this.reloadPlugins()
  }

  reloadPlugins () {
    this.pagination.currentPage = 1
    this.plugins = []

    this.router.navigate([], { queryParams: { pluginType: this.pluginType } })

    this.loadMorePlugins()
  }

  loadMorePlugins () {
    this.pluginService.getPlugins(this.pluginType, this.pagination, this.sort)
        .subscribe(
          res => {
            this.plugins = this.plugins.concat(res.data)
            this.pagination.totalItems = res.total
          },

          err => this.notifier.error(err.message)
        )
  }

  onNearOfBottom () {
    if (!hasMoreItems(this.pagination)) return

    this.pagination.currentPage += 1

    this.loadMorePlugins()
  }

  getNoResultMessage () {
    if (this.pluginType === PluginType.PLUGIN) {
      return this.i18n('You don\'t have plugins installed yet.')
    }

    return this.i18n('You don\'t have themes installed yet.')
  }

  isUpdateAvailable (plugin: PeerTubePlugin) {
    return plugin.latestVersion && compareSemVer(plugin.latestVersion, plugin.version) > 0
  }

  getUpdateLabel (plugin: PeerTubePlugin) {
    return this.i18n('Update to {{version}}', { version: plugin.latestVersion })
  }

  isUpdating (plugin: PeerTubePlugin) {
    return !!this.updating[this.getUpdatingKey(plugin)]
  }

  async uninstall (plugin: PeerTubePlugin) {
    const res = await this.confirmService.confirm(
      this.i18n('Do you really want to uninstall {{pluginName}}?', { pluginName: plugin.name }),
      this.i18n('Uninstall')
    )
    if (res === false) return

    this.pluginService.uninstall(plugin.name, plugin.type)
      .subscribe(
        () => {
          this.notifier.success(this.i18n('{{pluginName}} uninstalled.', { pluginName: plugin.name }))

          this.plugins = this.plugins.filter(p => p.name !== plugin.name)
          this.pagination.totalItems--
        },

        err => this.notifier.error(err.message)
      )
  }

  async update (plugin: PeerTubePlugin) {
    const updatingKey = this.getUpdatingKey(plugin)
    if (this.updating[updatingKey]) return

    this.updating[updatingKey] = true

    this.pluginService.update(plugin.name, plugin.type)
        .pipe()
        .subscribe(
          res => {
            this.updating[updatingKey] = false

            this.notifier.success(this.i18n('{{pluginName}} updated.', { pluginName: plugin.name }))

            Object.assign(plugin, res)
          },

          err => this.notifier.error(err.message)
        )
  }

  getShowRouterLink (plugin: PeerTubePlugin) {
    return [ '/admin', 'plugins', 'show', this.pluginService.nameToNpmName(plugin.name, plugin.type) ]
  }

  private getUpdatingKey (plugin: PeerTubePlugin) {
    return plugin.name + plugin.type
  }
}
