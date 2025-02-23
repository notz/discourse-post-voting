import I18n from "I18n";
import { withPluginApi } from "discourse/lib/plugin-api";

export const ORDER_BY_ACTIVITY_FILTER = "activity";
const pluginId = "discourse-post-voting";

function initPlugin(api) {
  api.removePostMenuButton("reply", (attrs) => {
    return attrs.post_voting_has_votes !== undefined;
  });

  api.removePostMenuButton("like", (_attrs, _state, siteSetting) => {
    return (
      _attrs.post_voting_has_votes !== undefined &&
      _attrs.post_number !== 1 &&
      !siteSetting.qa_enable_likes_on_answers
    );
  });

  api.addPostMenuButton("answer", (attrs) => {
    if (
      attrs.post_voting_has_votes === undefined ||
      attrs.post_number !== 1 ||
      !attrs.canCreatePost
    ) {
      return;
    }

    const args = {
      action: "replyToPost",
      title: "post_voting.topic.answer.help",
      icon: "reply",
      className: "reply create fade-out",
      position: "last",
    };

    if (!attrs.mobileView) {
      args.label = "post_voting.topic.answer.label";
    }

    return args;
  });

  api.modifyClass("model:post-stream", {
    pluginId,

    orderStreamByActivity() {
      this.cancelFilter();
      this.set("filter", ORDER_BY_ACTIVITY_FILTER);
      return this.refreshAndJumpToSecondVisible();
    },

    orderStreamByVotes() {
      this.cancelFilter();
      return this.refreshAndJumpToSecondVisible();
    },
  });

  function customLastUnreadUrl(context) {
    if (context.is_post_voting && context.last_read_post_number) {
      if (context.highest_post_number <= context.last_read_post_number) {
        // link to OP if no unread
        return context.urlForPostNumber(1);
      } else if (
        context.last_read_post_number ===
        context.highest_post_number - 1
      ) {
        return context.urlForPostNumber(context.last_read_post_number + 1);
      } else {
        // sort by activity if user has 2+ unread posts
        return `${context.urlForPostNumber(
          context.last_read_post_number + 1
        )}?filter=activity`;
      }
    }
  }
  api.registerCustomLastUnreadUrlCallback(customLastUnreadUrl);

  api.reopenWidget("post", {
    orderByVotes() {
      this._topicController()
        .model.postStream.orderStreamByVotes()
        .then(() => {
          this._refreshController();
        });
    },

    orderByActivity() {
      this._topicController()
        .model.postStream.orderStreamByActivity()
        .then(() => {
          this._refreshController();
        });
    },

    _refreshController() {
      this._topicController().updateQueryParams();
      this._topicController().appEvents.trigger("post-voting-topic-updated");
    },

    _topicController() {
      return this.register.lookup("controller:topic");
    },
  });

  api.decorateWidget("post-article:before", (helper) => {
    const result = [];
    const post = helper.getModel();

    if (!post.topic.is_post_voting) {
      return result;
    }

    const topicController = helper.widget.register.lookup("controller:topic");
    let positionInStream;

    if (
      topicController.replies_to_post_number &&
      parseInt(topicController.replies_to_post_number, 10) !== 1
    ) {
      positionInStream = 2;
    } else {
      positionInStream = 1;
    }

    const answersCount = post.topic.posts_count - 1;

    if (
      answersCount <= 0 ||
      post.id !== post.topic.postStream.stream[positionInStream]
    ) {
      return result;
    }

    result.push(
      helper.h("div.post-voting-answers-header.small-action", [
        helper.h(
          "span.post-voting-answers-headers-count",
          I18n.t("post_voting.topic.answer_count", { count: answersCount })
        ),
        helper.h("span.post-voting-answers-headers-sort", [
          helper.h("span", I18n.t("post_voting.topic.sort_by")),
          helper.attach("button", {
            action: "orderByVotes",
            contents: I18n.t("post_voting.topic.votes"),
            disabled: topicController.filter !== ORDER_BY_ACTIVITY_FILTER,
            className: `post-voting-answers-headers-sort-votes ${
              topicController.filter === ORDER_BY_ACTIVITY_FILTER
                ? ""
                : "active"
            }`,
          }),
          helper.attach("button", {
            action: "orderByActivity",
            contents: I18n.t("post_voting.topic.activity"),
            disabled: topicController.filter === ORDER_BY_ACTIVITY_FILTER,
            className: `post-voting-answers-headers-sort-activity ${
              topicController.filter === ORDER_BY_ACTIVITY_FILTER
                ? "active"
                : ""
            }`,
          }),
        ]),
      ])
    );

    return result;
  });

  api.decorateWidget("post-menu:after", (helper) => {
    const result = [];
    const attrs = helper.widget.attrs;

    if (
      attrs.post_voting_has_votes !== undefined &&
      !attrs.reply_to_post_number &&
      !helper.widget.state.filteredRepliesShown
    ) {
      result.push(helper.attach("post-voting-comments", attrs));
    }

    return result;
  });

  api.decorateWidget("post-avatar:after", function (helper) {
    const result = [];
    const model = helper.getModel();

    if (model.topic?.is_post_voting) {
      const postVotingPost = helper.attach("post-voting-post", {
        count: model.get("post_voting_vote_count"),
        post: model,
      });

      result.push(postVotingPost);
    }

    return result;
  });

  api.includePostAttributes(
    "comments",
    "comments_count",
    "post_voting_user_voted_direction",
    "post_voting_has_votes"
  );
}

export default {
  name: "post-voting-edits",
  initialize(container) {
    const siteSettings = container.lookup("site-settings:main");

    if (!siteSettings.qa_enabled) {
      return;
    }

    withPluginApi("1.2.0", initPlugin);
  },
};
