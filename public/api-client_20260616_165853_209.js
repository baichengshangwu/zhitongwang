// Nexus Social - LeanCloud API Client
// Replace the old Express backend with LeanCloud BaaS

// ========== LeanCloud 配置 ==========
// 请在 leancloud.cn 创建应用后，替换下面的 AppID 和 AppKey
const LC_APP_ID = 'YOUR_LEANCLOUD_APP_ID';
const LC_APP_KEY = 'YOUR_LEANCLOUD_APP_KEY';
const LC_SERVER = 'https://YOUR_APP_ID.lc-cn-n1-shared.com';

AV.init({ appId: LC_APP_ID, appKey: LC_APP_KEY, serverURL: LC_SERVER });

// ========== 用户认证 ==========
const Auth = {
  currentUser() {
    return AV.User.current();
  },

  async register(email, password, name) {
    const user = new AV.User();
    user.setUsername(email);
    user.setPassword(password);
    user.setEmail(email);
    user.set('nickname', name || email.split('@')[0]);
    user.set('avatar', '');
    user.set('bio', '');
    user.set('joinedAt', new Date());
    return user.signUp();
  },

  async login(email, password) {
    return AV.User.logIn(email, password);
  },

  logout() {
    AV.User.logOut();
  }
};

// ========== 好友搜索 ==========
const Friends = {
  async searchByEmail(email) {
    const query = new AV.Query('_User');
    query.equalTo('email', email);
    const users = await query.find();
    return users.map(u => ({
      objectId: u.id,
      email: u.getEmail(),
      nickname: u.get('nickname') || '',
      avatar: u.get('avatar') || '',
      bio: u.get('bio') || '',
      joinedAt: u.get('joinedAt')
    }));
  },

  async sendRequest(toUserId) {
    const from = AV.User.current();
    if (!from) throw new Error('请先登录');
    if (from.id === toUserId) throw new Error('不能添加自己为好友');

    // 检查是否已经是好友
    const existCheck = new AV.Query('Friend');
    existCheck.equalTo('user', from);
    const existCheck2 = new AV.Query('Friend');
    existCheck2.equalTo('friend', AV.Object.createWithoutData('_User', toUserId));
    const existQuery = AV.Query.and(existCheck, existCheck2);
    const existing = await existQuery.first();
    if (existing) throw new Error('已经是好友');

    // 检查是否已有待处理的请求
    const pendingCheck = new AV.Query('FriendRequest');
    pendingCheck.equalTo('fromUser', from);
    pendingCheck.equalTo('toUser', AV.Object.createWithoutData('_User', toUserId));
    pendingCheck.equalTo('status', 'pending');
    const pending = await pendingCheck.first();
    if (pending) throw new Error('已发送过好友请求');

    const FriendRequest = AV.Object.extend('FriendRequest');
    const request = new FriendRequest();
    request.set('fromUser', from);
    request.set('toUser', AV.Object.createWithoutData('_User', toUserId));
    request.set('status', 'pending');
    return request.save();
  },

  async getPendingRequests() {
    const user = AV.User.current();
    if (!user) return [];
    const query = new AV.Query('FriendRequest');
    query.equalTo('toUser', user);
    query.equalTo('status', 'pending');
    query.include('fromUser');
    query.descending('createdAt');
    const requests = await query.find();
    return requests.map(r => {
      const from = r.get('fromUser');
      return {
        objectId: r.id,
        fromUser: {
          objectId: from.id,
          email: from.getEmail(),
          nickname: from.get('nickname') || '',
          avatar: from.get('avatar') || ''
        },
        createdAt: r.createdAt
      };
    });
  },

  async acceptRequest(requestId) {
    const query = new AV.Query('FriendRequest');
    const request = await query.get(requestId);
    request.set('status', 'accepted');

    // 创建双向好友关系
    const fromUser = request.get('fromUser');
    const toUser = request.get('toUser');

    const Friend = AV.Object.extend('Friend');
    const f1 = new Friend();
    f1.set('user', fromUser);
    f1.set('friend', toUser);
    await f1.save();

    const f2 = new Friend();
    f2.set('user', toUser);
    f2.set('friend', fromUser);
    await f2.save();

    return request.save();
  },

  async rejectRequest(requestId) {
    const query = new AV.Query('FriendRequest');
    const request = await query.get(requestId);
    request.set('status', 'rejected');
    return request.save();
  },

  async getFriendList() {
    const user = AV.User.current();
    if (!user) return [];
    const query = new AV.Query('Friend');
    query.equalTo('user', user);
    query.include('friend');
    query.descending('createdAt');
    const friends = await query.find();
    return friends.map(f => {
      const friend = f.get('friend');
      return {
        objectId: friend.id,
        email: friend.getEmail(),
        nickname: friend.get('nickname') || '',
        avatar: friend.get('avatar') || ''
      };
    });
  }
};

// ========== 消息 ==========
const Messages = {
  async send(toUserId, content) {
    const from = AV.User.current();
    if (!from) throw new Error('请先登录');
    const Message = AV.Object.extend('Message');
    const msg = new Message();
    msg.set('fromUser', from);
    msg.set('toUser', AV.Object.createWithoutData('_User', toUserId));
    msg.set('content', content);
    msg.set('read', false);
    return msg.save();
  },

  async getConversation(friendId, limit = 50) {
    const user = AV.User.current();
    if (!user) return [];

    const userPtr = AV.Object.createWithoutData('_User', friendId);

    // 我发给对方的
    const q1 = new AV.Query('Message');
    q1.equalTo('fromUser', user);
    q1.equalTo('toUser', userPtr);

    // 对方发给我的
    const q2 = new AV.Query('Message');
    q2.equalTo('fromUser', userPtr);
    q2.equalTo('toUser', user);

    const query = AV.Query.or(q1, q2);
    query.include('fromUser');
    query.include('toUser');
    query.ascending('createdAt');
    query.limit(limit);

    const messages = await query.find();
    return messages.map(m => ({
      objectId: m.id,
      from: m.get('fromUser').id,
      to: m.get('toUser').id,
      content: m.get('content'),
      createdAt: m.createdAt
    }));
  },

  // 标记消息为已读
  async markRead(fromUserId) {
    const user = AV.User.current();
    const fromPtr = AV.Object.createWithoutData('_User', fromUserId);
    const query = new AV.Query('Message');
    query.equalTo('toUser', user);
    query.equalTo('fromUser', fromPtr);
    query.equalTo('read', false);
    const unread = await query.find();
    for (const msg of unread) {
      msg.set('read', true);
    }
    return AV.Object.saveAll(unread);
  }
};

// ========== LiveQuery 实时消息监听 ==========
let liveQuerySubscription = null;
let messageCallback = null;

const Realtime = {
  async startListening(onMessage) {
    messageCallback = onMessage;
    const user = AV.User.current();
    if (!user) return;

    // 监听发给当前用户的新消息
    const query = new AV.Query('Message');
    query.equalTo('toUser', user);
    query.equalTo('read', false);

    liveQuerySubscription = await query.subscribe();
    liveQuerySubscription.on('create', async (msg) => {
      const fromUser = msg.get('fromUser');
      await fromUser.fetch();
      if (messageCallback) {
        messageCallback({
          objectId: msg.id,
          from: fromUser.id,
          fromName: fromUser.get('nickname') || fromUser.getEmail(),
          content: msg.get('content'),
          createdAt: msg.createdAt
        });
      }
    });
  },

  stopListening() {
    if (liveQuerySubscription) {
      liveQuerySubscription.unsubscribe();
      liveQuerySubscription = null;
    }
  }
};

// 兼容旧接口
window.Auth = Auth;
window.Friends = Friends;
window.Messages = Messages;
window.Realtime = Realtime;
