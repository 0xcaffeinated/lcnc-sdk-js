import { BaseSDK, globalInstances, LISTENER_CMDS } from "../core";
import { EVENT_TYPES } from "../core/constants";
import { CreateProxy } from "../core/proxy";

import { Page } from "./page";

import { AppContext } from "../types/internal";
import { rolesObject } from "../types/external";

import { DecisionTable } from "./decisiontable";
import { Dataform } from "../dataform";
import { Board } from "../board";
import { Process } from "../process";

export class Application extends BaseSDK {
	page: Page;
	// variable: AppVariable;
	_id: string;

	constructor(props: AppContext, isCustomComponent: boolean = false) {
		super();
		this._id = props.appId;
		// Registered so the host can address this instance when it pushes an
		// event back — onRunComplete is delivered that way, and without this the
		// host resolves globalInstances[target] to undefined and the callback
		// can never fire. Component does the same for the same reason.
		globalInstances[this._id] = this;
		this.page = new Page(props);
		// /* Note: Synchronous variable read/write is not supported for custom components
		//  * as it is not possible to use Atomics.wait in the main thread and iframe thread
		//  */
		// !isCustomComponent && (this.variable = new AppVariable());
	}
	getVariable(key: string) {
		return this._postMessageAsync(LISTENER_CMDS.GET_APP_VARIABLE, {
			key
		});
	}

	setVariable(key: string | object, value?: any) {
		return this._postMessageAsync(LISTENER_CMDS.SET_APP_VARIABLE, {
			key,
			value
		});
	}

	openPage(pageId: string, pageParams?: object) {
		return this._postMessageAsync(LISTENER_CMDS.OPEN_PAGE, {
			pageId,
			pageParams
		});
	}

	/**
	 * Run an App Function by name.
	 *
	 * Mode is a property of the function, not of the call, so one method serves
	 * both: an Interactive function answers with its result, a Background one
	 * answers as soon as the run is queued and finishes on a worker.
	 *
	 *   Interactive -> { RunId, Status: "Success", Result: {…} }
	 *   Background  -> { RunId, Status: "Queued" }
	 */
	runFunction(name: string, parameters?: object) {
		return this._postMessageAsync(LISTENER_CMDS.APP_FUNCTION_RUN, {
			name,
			parameters: parameters ?? {}
		});
	}

	/**
	 * Read a run back — its status, and its output once there is one.
	 *
	 * A result can be large, so it is fetched rather than pushed. This is also
	 * the fallback when a completion is missed: a page that reloads mid-run has
	 * no listener attached, and the run document is the durable record.
	 */
	getRun(runId: string) {
		return this._postMessageAsync(LISTENER_CMDS.APP_FUNCTION_GET_RUN, {
			runId
		});
	}

	/**
	 * Be told when a Background run reaches a terminal state.
	 *
	 * The callback fires once, with the completed run. Status arrives over a
	 * push channel; the result itself is fetched, which is why the callback is
	 * handed the run rather than a bare status. A run that has already finished
	 * before this is called will not fire — use getRun for that case.
	 */
	onRunComplete(runId: string, callBack: (run: any) => any) {
		this._postMessage(
			LISTENER_CMDS.APP_FUNCTION_ON_RUN_COMPLETE,
			{
				// The host addresses its reply to this instance.
				id: this._id,
				runId,
				// Scoped per run: two runs in flight must not share a callback.
				eventName: `${EVENT_TYPES.APP_FUNCTION_RUN_COMPLETE}:${runId}`,
				eventConfig: {
					once: true
				}
			},
			callBack
		);
	}

	getDecisionTable(flowId: string): DecisionTable {
		return new DecisionTable(flowId);
	}

	getDataform(flowId: string): Dataform {
		return new Dataform(flowId);
	}

	getBoard(flowId: string) {
		return new Board(flowId);
	}

	getProcess(flowId: string) {
		return new Process(flowId);
	}

	/**
	 * List the app's roles and which of them the current user is a member of.
	 *
	 * Only available in a Development account - use this to build a role
	 * picker UI inside the component, then pass the chosen role to
	 * {@link switchRole}.
	 *
	 * @returns A promise that resolves with `{ roles, currentRoles }` - the
	 * full list of app roles and the subset the current user belongs to.
	 *
	 * @example
	 * const { roles, currentRoles } = await kf.app.getRoles();
	 */
	getRoles(): Promise<{ roles: rolesObject[]; currentRoles: rolesObject[] }> {
		return this._postMessageAsync(LISTENER_CMDS.GET_ROLES, {}) as Promise<{
			roles: rolesObject[];
			currentRoles: rolesObject[];
		}>;
	}

	/**
	 * Switch the current user's active role in a Development account.
	 *
	 * This performs a real role change - it removes the user from their
	 * current role(s) and adds them to the target role. The platform's app
	 * shell (top nav, other widgets) picks up the new role on its own; no
	 * page reload happens. Only available in a Development account.
	 *
	 * @param args - Either `roleId` or `roleName` identifying the target role
	 * (use the values returned by {@link getRoles}).
	 * @returns A promise that resolves with the switched-to role.
	 *
	 * @example
	 * const { roles } = await kf.app.getRoles();
	 * await kf.app.switchRole({ roleId: roles[1]._id });
	 */
	switchRole(args: { roleId?: string; roleName?: string }) {
		return this._postMessageAsync(LISTENER_CMDS.SWITCH_ROLE, {
			roleId: args.roleId,
			roleName: args.roleName
		}) as Promise<rolesObject>;
	}
}


class AppVariable extends BaseSDK {
	constructor() {
		super()
		return new CreateProxy(this)
	}

	get(key, path) {
		let args = {
			key,
			path: path
		}
		return this._postMessageSync(LISTENER_CMDS.GET_APP_VARIABLE, args);
	}

	set(key, value, path) {
		let args = {
			key,
			value,
			path
		}
		return this._postMessageSync(LISTENER_CMDS.SET_APP_VARIABLE, args);
	}
}

export * from "./component";
export { Page };
export * from "./popup";
