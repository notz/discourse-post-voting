# frozen_string_literal: true

require 'rails_helper'

RSpec.describe QuestionAnswer::VotesController, :type => :request do
  fab!(:tag) { Fabricate(:tag) }
  fab!(:topic) { Fabricate(:topic, tags: [tag]) }
  fab!(:qa_post) { Fabricate(:post, topic: topic) } # don't set this as :post
  fab!(:qa_user) { Fabricate(:user) }
  let(:vote_params) do
    {
      vote: {
        post_id: qa_post.id,
        user_id: qa_user.id,
        direction: QuestionAnswer::Vote::UP
      }
    }
  end
  let(:get_voters) { ->(params = nil) { get '/qa/voters.json', params: params || vote_params } }
  let(:create_vote) { ->(params = nil) { post '/qa/vote.json', params: params || vote_params } }

  before do
    SiteSetting.qa_enabled = true
    SiteSetting.qa_tags = tag.name
  end

  describe '#ensure_logged_in' do
    it 'should return 403 when not logged in' do
      get_voters.call

      expect(response.status).to eq(403)
    end
  end

  context '#find_vote_post' do
    before { sign_in(qa_user) }

    it 'should find post by post_id param' do
      get_voters.call post_id: qa_post.id

      expect(response.status).to eq(200)
    end

    it 'should find post by vote.post_id param' do
      get_voters.call

      expect(response.status).to eq(200)
    end

    it 'should return 404 if no post found' do
      get_voters.call post_id: qa_post.id + 1000

      expect(response.status).to eq(404)
    end
  end

  describe '#find_vote_user' do
    before { sign_in(qa_user) }

    it 'should return 404 if user not found' do
      vote_params[:vote][:user_id] += 1000

      create_vote.call

      expect(response.status).to eq(404)
    end
  end

  describe '#ensure_qa_enabled' do
    it 'should return 403 if plugin disabled' do
      SiteSetting.qa_enabled = false

      sign_in(qa_user)
      create_vote.call

      expect(response.status).to eq(403)
    end
  end

  describe '#create' do
    before { sign_in(qa_user) }

    it 'should success if never voted' do
      create_vote.call

      expect(response.status).to eq(200)
    end

    it 'should error if already voted' do
      2.times { create_vote.call }

      expect(response.status).to eq(403)
    end
  end

  describe '#destroy' do
    before { sign_in(qa_user) }

    it 'should success if has voted' do
      create_vote.call
      delete '/qa/vote.json', params: vote_params

      expect(response.status).to eq(200)
    end

    it 'should error if never voted' do
      delete '/qa/vote.json', params: vote_params

      expect(response.status).to eq(403)
    end
  end
end
