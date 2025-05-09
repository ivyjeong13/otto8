import { z } from "zod";

import { EntityList } from "~/lib/model/primitives";
import { User } from "~/lib/model/users";
import { ApiRoutes } from "~/lib/routers/apiRoutes";
import { request } from "~/lib/service/api/primitives";
import { createFetcher } from "~/lib/service/api/service-primitives";

const handleGetUsers = createFetcher(
	z.object({
		filters: z.object({ userId: z.string().optional() }).optional(),
	}),
	async ({ filters = {} }, { signal }) => {
		const { url } = ApiRoutes.users.base();
		const { data } = await request<EntityList<User>>({ url, signal });

		const { userId } = filters;

		if (userId) data.items = data.items?.filter((u) => u.id === userId);

		return data.items ?? [];
	},
	() => ApiRoutes.users.base().path
);

async function getMe() {
	const res = await request<User>({
		url: ApiRoutes.me().url,
		errorMessage: "Failed to fetch agents",
	});

	return res.data;
}
getMe.key = () => ({ url: ApiRoutes.me().path }) as const;

async function updateUser(username: string, user: Partial<User>) {
	const { data } = await request<User>({
		url: ApiRoutes.users.updateUser(username).url,
		method: "PATCH",
		data: user,
		errorMessage: "Failed to update user",
	});

	return data;
}

const handleGetUser = createFetcher(
	z.object({ userId: z.string() }),
	async ({ userId }, { signal }) => {
		const { url } = ApiRoutes.users.getOne(userId);
		const { data } = await request<User>({ url, signal });
		return data;
	},
	() => ApiRoutes.users.getOne(":userId").path
);

async function deleteUser(username: string) {
	const { data } = await request<User>({
		url: ApiRoutes.users.deleteUser(username).url,
		method: "DELETE",
		errorMessage: "Failed to delete user",
	});

	return data;
}

export const UserService = {
	getMe,
	getUsers: handleGetUsers,
	updateUser,
	getUser: handleGetUser,
	deleteUser,
};
