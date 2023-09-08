import validator from 'validator';
import _ from 'lodash';
import * as topics from '../topics';
import * as user from '../user';
import * as plugins from '../plugins';
import * as categories from '../categories';
import * as utils from '../utils';

interface options_type {
    hasOwnProperty: (property: string) => boolean;
    stripTags: string | boolean;
    parse: string | boolean;
    extraFields: string[];
}

interface topic_field {
    cid: number;
    mainPid: number;
}
interface post_specs {
    uid: number;
    tid: number;
    cid: number;
    pid: number;
    user: object;
    handle: undefined;
    topic: topic_field;
    category: boolean;
    isMainPost: boolean;
    deleted: boolean;
    timestamp: Date;
    timestampISO: string;
}

interface post_fields {
    filter: (filter_fn: object) => post_fields;
    map: ((p: object) => boolean[]) | ((p: object) => post_fields[]);
    forEach: (post: (post: post_specs) => void) => void;
    // callbackfn: (value: boolean, index: number, array: boolean[]) => void
}

interface post_param {
    getPostSummaryByPids: (pids: number, uid: number, options: options_type) => Promise<any>;
    getPostsFields: (pids: number, fields: string[]) => post_fields;
    overrideGuestHandle: (post: post_specs, handle: undefined) => void; //unsure 
    parsePost: (post: post_specs) => post_fields;
}
export default function (Posts: post_param) {
    Posts.getPostSummaryByPids = async function (pids: number, uid: number, options: options_type) {
        if (!Array.isArray(pids) || !pids.length) {
            return [];
        }
        options.stripTags = options.hasOwnProperty('stripTags') ? options.stripTags : false;
        options.parse = options.hasOwnProperty('parse') ? options.parse : true;
        options.extraFields = options.hasOwnProperty('extraFields') ? options.extraFields : [];
        const fields: string[] = ['pid', 'tid', 'content', 'uid', 'timestamp', 'deleted', 'upvotes', 'downvotes', 'replies', 'handle'].concat(options.extraFields);
        let posts: post_fields = Posts.getPostsFields(pids, fields);
        posts = posts.filter(Boolean);
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-assignment
        posts = await user.blocks.filter(uid, posts);

        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return
        const uids: boolean[] = _.uniq(posts.map(p => p && p.uid));

        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return
        const tids: boolean[] = _.uniq(posts.map(p => p && p.tid));

        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return
        const [users, topicsAndCategories] = await Promise.all([
            user.getUsersFields(uids, ['uid', 'username', 'userslug', 'picture', 'status']),
            getTopicAndCategories(tids),
        ]);
        const uidToUser: object = toObject('uid', users);
        const tidToTopic: object = toObject('tid', topicsAndCategories.topics);
        const cidToCategory: object = toObject('cid', topicsAndCategories.categories);
        posts.forEach((post) => {
            // If the post author isn't represented in the retrieved users' data,
            // then it means they were deleted, assume guest.
            if (!uidToUser.hasOwnProperty(post.uid)) {
                post.uid = 0;
            }
            post.user = uidToUser[post.uid];
            Posts.overrideGuestHandle(post, post.handle);
            post.handle = undefined;
            post.topic = tidToTopic[post.tid];
            post.category = post.topic && cidToCategory[post.topic.cid];
            post.isMainPost = post.topic && post.pid === post.topic.mainPid;
            post.deleted = false;
            post.timestampISO = utils.toISOString(post.timestamp);
        });
        posts = posts.filter(post => tidToTopic[post.tid]);
        posts = await parsePosts(posts, options);
        const result = await plugins.hooks.fire('filter:post.getPostSummaryByPids', { posts: posts, uid: uid });
        return result.posts;
    };

    async function parsePosts(posts: post_fields, options: options_type): Promise<post_fields> {
        return await Promise.all(posts.map(async (post) => {
            if (!post.content || !options.parse) {
                post.content = post.content ? validator.escape(String(post.content)) : post.content;
                return post;
            }
            post = Posts.parsePost(post);
            if (options.stripTags) {
                post.content = stripTags(post.content);
            }
            return post;
        }));
    }
    async function getTopicAndCategories(tids: boolean[]): Promise<any> {
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-assignment
        const topicsData = await topics.getTopicsFields(tids, [
            'uid', 'tid', 'title', 'cid', 'tags', 'slug',
            'deleted', 'scheduled', 'postcount', 'mainPid', 'teaserPid',
        ]);
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-assignment
        const cids = _.uniq(topicsData.map(topic => topic && topic.cid));
        const categoriesData = await categories.getCategoriesFields(cids, [
            'cid', 'name', 'icon', 'slug', 'parentCid',
            'bgColor', 'color', 'backgroundImage', 'imageClass',
        ]);
        return { topics: topicsData, categories: categoriesData };
    }
    function toObject(key: string, data) {
        const obj= {};
        for (let i = 0; i < data.length; i += 1) {
            obj[data[i][key]] = data[i];
        }
        return obj;
    }
    function stripTags(content: string): string {
        if (content) {
            return utils.stripHTMLTags(content, utils.stripTags);
        }
        return content;
    }
};
