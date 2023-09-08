"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const validator_1 = __importDefault(require("validator"));
const lodash_1 = __importDefault(require("lodash"));
const topics = __importStar(require("../topics"));
const user = __importStar(require("../user"));
const plugins = __importStar(require("../plugins"));
const categories = __importStar(require("../categories"));
const utils = __importStar(require("../utils"));
function default_1(Posts) {
    Posts.getPostSummaryByPids = function (pids, uid, options) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!Array.isArray(pids) || !pids.length) {
                return [];
            }
            options.stripTags = options.hasOwnProperty('stripTags') ? options.stripTags : false;
            options.parse = options.hasOwnProperty('parse') ? options.parse : true;
            options.extraFields = options.hasOwnProperty('extraFields') ? options.extraFields : [];
            const fields = ['pid', 'tid', 'content', 'uid', 'timestamp', 'deleted', 'upvotes', 'downvotes', 'replies', 'handle'].concat(options.extraFields);
            let posts = Posts.getPostsFields(pids, fields);
            posts = posts.filter(Boolean);
            // The next line calls a function in a module that has not been updated to TS yet
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-assignment
            posts = yield user.blocks.filter(uid, posts);
            // The next line calls a function in a module that has not been updated to TS yet
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return
            const uids = lodash_1.default.uniq(posts.map(p => p && p.uid));
            // The next line calls a function in a module that has not been updated to TS yet
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return
            const tids = lodash_1.default.uniq(posts.map(p => p && p.tid));
            // The next line calls a function in a module that has not been updated to TS yet
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return
            const [users, topicsAndCategories] = yield Promise.all([
                user.getUsersFields(uids, ['uid', 'username', 'userslug', 'picture', 'status']),
                getTopicAndCategories(tids),
            ]);
            const uidToUser = toObject('uid', users);
            const tidToTopic = toObject('tid', topicsAndCategories.topics);
            const cidToCategory = toObject('cid', topicsAndCategories.categories);
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
            posts = yield parsePosts(posts, options);
            const result = yield plugins.hooks.fire('filter:post.getPostSummaryByPids', { posts: posts, uid: uid });
            return result.posts;
        });
    };
    function parsePosts(posts, options) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield Promise.all(posts.map((post) => __awaiter(this, void 0, void 0, function* () {
                if (!post.content || !options.parse) {
                    post.content = post.content ? validator_1.default.escape(String(post.content)) : post.content;
                    return post;
                }
                post = Posts.parsePost(post);
                if (options.stripTags) {
                    post.content = stripTags(post.content);
                }
                return post;
            })));
        });
    }
    function getTopicAndCategories(tids) {
        return __awaiter(this, void 0, void 0, function* () {
            // The next line calls a function in a module that has not been updated to TS yet
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-assignment
            const topicsData = yield topics.getTopicsFields(tids, [
                'uid', 'tid', 'title', 'cid', 'tags', 'slug',
                'deleted', 'scheduled', 'postcount', 'mainPid', 'teaserPid',
            ]);
            // The next line calls a function in a module that has not been updated to TS yet
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-assignment
            const cids = lodash_1.default.uniq(topicsData.map(topic => topic && topic.cid));
            const categoriesData = yield categories.getCategoriesFields(cids, [
                'cid', 'name', 'icon', 'slug', 'parentCid',
                'bgColor', 'color', 'backgroundImage', 'imageClass',
            ]);
            return { topics: topicsData, categories: categoriesData };
        });
    }
    function toObject(key, data) {
        const obj = {};
        for (let i = 0; i < data.length; i += 1) {
            obj[data[i][key]] = data[i];
        }
        return obj;
    }
    function stripTags(content) {
        if (content) {
            return utils.stripHTMLTags(content, utils.stripTags);
        }
        return content;
    }
}
exports.default = default_1;
;
