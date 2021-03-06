/*
 * Copyright 2018-2020 IBM Corporation
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import { IDictionary, NotebookParser } from '@elyra/application';
import { JupyterFrontEnd } from '@jupyterlab/application';
import { Dialog, showDialog, ToolbarButton } from '@jupyterlab/apputils';
import { DocumentRegistry } from '@jupyterlab/docregistry';
import { INotebookModel, NotebookPanel } from '@jupyterlab/notebook';

import { JSONObject, JSONValue } from '@lumino/coreutils';
import { IDisposable } from '@lumino/disposable';
import { Widget } from '@lumino/widgets';

import { PipelineService } from './PipelineService';
import Utils from './utils';

/**
 * Details about notebook submission configuration, including
 * details about the remote runtime and any other
 * user details required to access/start the job
 */
export interface ISubmitNotebookConfiguration extends JSONObject {
  runtime_config: string;
  framework: string;
  //cpus: number,
  //gpus: number,
  //memory: string,
  dependencies: string[];

  env: string[];
}

/**
 * Details about notebook submission task, includes the submission
 * configuration plus the notebook contents that is being submitted
 */
export interface ISubmitNotebookOptions extends ISubmitNotebookConfiguration {
  kernelspec: string;
  notebook_name: string;
  notebook_path: string;
  notebook: JSONValue;
}

/**
 * Submit notebook button extension
 *  - Attach button to notebook toolbar and launch a dialog requesting
 *  information about the remote location to where submit the notebook
 *  for execution
 */
export class SubmitNotebookButtonExtension
  implements DocumentRegistry.IWidgetExtension<NotebookPanel, INotebookModel> {
  private panel: NotebookPanel;

  constructor(app: JupyterFrontEnd) {
    this.app = app;
  }

  readonly app: JupyterFrontEnd;

  showWidget = async (): Promise<void> => {
    const envVars: string[] = NotebookParser.getEnvVars(
      this.panel.content.model.toString()
    );

    const runtimes = await PipelineService.getRuntimes();
    const runtimeImages = await PipelineService.getRuntimeImages();

    showDialog({
      title: 'Submit notebook',
      body: new SubmitNotebook(envVars, runtimes, runtimeImages),
      buttons: [Dialog.cancelButton(), Dialog.okButton()]
    }).then(result => {
      if (result.value == null) {
        // When Cancel is clicked on the dialog, just return
        return;
      }

      // prepare notebook submission details
      const notebookOptions: ISubmitNotebookOptions = result.value as ISubmitNotebookOptions;
      const pipeline = Utils.generateNotebookPipeline(
        this.panel.context.path,
        notebookOptions
      );

      PipelineService.submitPipeline(pipeline, result.value.runtime_config);
    });
  };

  createNew(
    panel: NotebookPanel,
    context: DocumentRegistry.IContext<INotebookModel>
  ): IDisposable {
    this.panel = panel;

    // Create the toolbar button
    const submitNotebookButton = new ToolbarButton({
      label: 'Submit Notebook ...',
      onClick: this.showWidget,
      tooltip: 'Submit Notebook ...'
    });

    // Add the toolbar button to the notebook
    panel.toolbar.insertItem(10, 'submitNotebook', submitNotebookButton);

    // The ToolbarButton class implements `IDisposable`, so the
    // button *is* the extension for the purposes of this method.
    return submitNotebookButton;
  }
}

/**
 * Submit notebook dialog extension
 * - Request information about the remote location to where submit the
 * notebook for execution
 */
export class SubmitNotebook extends Widget
  implements Dialog.IBodyWidget<ISubmitNotebookConfiguration> {
  _envVars: string[];
  _runtimes: any;
  _runtimeImages: IDictionary<string>;

  constructor(
    envVars: string[],
    runtimes: any,
    runtimeImages: IDictionary<string>
  ) {
    super();

    this._envVars = envVars;
    this._runtimes = runtimes;
    this._runtimeImages = runtimeImages;

    this.node.appendChild(this.renderHtml());
    (this.node.getElementsByClassName(
      'elyra-form-runtime-config'
    )[0] as HTMLSelectElement).value = '';
    (this.node.getElementsByClassName(
      'elyra-form-framework'
    )[0] as HTMLSelectElement).value = '';
  }

  /**
   * Render the dialog widget used to gather configuration information
   * required to submit/run the notebook remotely
   */
  renderHtml(): HTMLElement {
    const tr = '<tr>'; //'<tr style="padding: 1px;">';
    const td = '<td>'; //'<td style="padding: 1px;">';
    const td_colspan2 = '<td colspan=2>'; //'<td style="padding: 1px;" colspan=2>';
    const td_colspan3 = '<td colspan=3>'; //'<td style="padding: 1px;" colspan=3>';
    //var td_colspan4 = '<td colspan=4>'; //'<td style="padding: 1px;" colspan=4>';

    const htmlContent = document.createElement('div');
    let runtime_options = '';
    let runtimeImages_options = '';

    for (const key in this._runtimes) {
      runtime_options =
        runtime_options +
        `<option value="${this._runtimes[key]['name']}">${this._runtimes[key]['display_name']}</option>`;
    }

    for (const image in this._runtimeImages) {
      runtimeImages_options =
        runtimeImages_options +
        `<option value="${image}" >${this._runtimeImages[image]}</option>`;
    }

    const content =
      '' +
      '<table id="table-submit-dialog" class="elyra-table"><tbody>' +
      tr +
      td_colspan2 +
      '<label for="runtime_config">Runtime Config:</label>' +
      '<br/>' +
      '<select id="runtime_config" class="elyra-form-runtime-config">' +
      runtime_options +
      '</select>' +
      '</td>' +
      td_colspan2 +
      '<label for="framework">Runtime images:</label>' +
      '<br/>' +
      '<select id="framework" class="elyra-form-framework">' +
      runtimeImages_options +
      '</select>' +
      '</td>' +
      '</tr>' +
      // + tr
      // + td
      // +'<label for="cpus">CPUs:</label>'
      // +'<br/>'
      // +'<input type="text" id="cpus" name="cpus" placeholder="1" value="1"/>'
      // +'</td>'
      //
      // + td
      // +'<label for="gpus">GPUs:</label>'
      // +'<br/>'
      // +'<input type="text" id="gpus" name="gpus" placeholder="0" value="0"/>'
      // +'</td>'
      //
      // + td
      // +'<label for="memory">Memory:</label>'
      // +'<br/>'
      // +'<input type="text" id="memory" name="memory" placeholder="1Gb" value="1Gb"/>'
      // +'</td>'
      // +'</tr>'

      tr +
      td +
      '<br/>' +
      '<input type="checkbox" id="dependency_include" name="dependency_include" size="20" checked /> Include dependencies<br/>' +
      '</td>' +
      td_colspan3 +
      '<br/>' +
      '<input type="text" id="dependencies" name="dependencies" placeholder="*.py" value="*.py" size="20"/>' +
      '</td>' +
      '</tr>' +
      this.getEnvHtml() +
      '</tbody></table>';
    htmlContent.innerHTML = content;

    return htmlContent;
  }

  getEnvHtml(): string {
    const tr = '<tr>';
    const td = '<td>';
    const td_colspan4 = '<td colspan=4>';
    const subtitle =
      '<div style="font-size: var(--jp-ui-font-size3)">Environmental Variables</div>';

    if (this._envVars.length > 0) {
      let html = '' + tr + td_colspan4 + '</td>' + '</tr>';
      html = html + tr + td_colspan4 + subtitle + '</td>' + '</tr>';

      for (let i = 0; i < this._envVars.length; i++) {
        if (i % 4 === 0) {
          html = html + tr;
        }

        html =
          html +
          td +
          `<label for="envVar${i}">${this._envVars[i]}:</label>` +
          '<br/>' +
          `<input type="text" id="envVar${i}" class="envVar" name="envVar${i}" placeholder="" value="" size="20"/>` +
          '</td>';

        if (i % 4 === 3) {
          html = html + '</tr>';
        }
      }

      return html;
    } else {
      return '';
    }
  }

  getValue(): ISubmitNotebookConfiguration {
    let dependency_list: string[] = [];
    if (
      (document.getElementById('dependency_include') as HTMLInputElement)
        .checked
    ) {
      dependency_list = (document.getElementById(
        'dependencies'
      ) as HTMLInputElement).value.split(',');
    }

    const envVars: string[] = [];

    const envElements = document.getElementsByClassName('envVar');

    for (let i = 0; i < envElements.length; i++) {
      const index: number = parseInt(envElements[i].id.match(/\d+/)[0], 10);
      envVars.push(
        `${this._envVars[index]}=${(envElements[i] as HTMLInputElement).value}`
      );
    }

    const returnData: ISubmitNotebookConfiguration = {
      runtime_config: (document.getElementById(
        'runtime_config'
      ) as HTMLSelectElement).value,
      framework: (document.getElementById('framework') as HTMLSelectElement)
        .value,
      //cpus: Number((<HTMLInputElement>document.getElementById('cpus')).value),
      //gpus: Number((<HTMLInputElement>document.getElementById('gpus')).value),
      //memory: (<HTMLInputElement>document.getElementById('memory')).value,
      dependencies: dependency_list,

      env: envVars
    };

    return returnData;
  }
}
