//
//  Network+Posts.swift
//  
//
//  Created by Miguel Alatzar on 8/26/21.
//

import Foundation

let POST_CHUNK_SIZE = 60

public struct PostData: Codable {
    let order: [String]
    let posts: [Post]
    let next_post_id: String
    let prev_post_id: String
    
    public enum PostDataKeys: String, CodingKey {
        case order, posts, next_post_id, prev_post_id
    }
    
    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: PostDataKeys.self)
        order = try container.decode([String].self, forKey: .order)
        next_post_id = try container.decode(String.self, forKey: .next_post_id)
        prev_post_id = try container.decode(String.self, forKey: .prev_post_id)
        
        let decodedPosts = try container.decode([String:Post].self, forKey: .posts)
        posts = Array(decodedPosts.values)
    }
}

extension Network {
    public func fetchPostsForChannel(withId channelId: String, withSince since: Int64?, withServerUrl serverUrl: String, completionHandler: @escaping ResponseHandler) {
        let queryParams = since == nil ?
            "?page=0&per_page=\(POST_CHUNK_SIZE)" :
            "?since=\(since!)"
        let url = URL(string: "\(serverUrl)/api/v4/channels/\(channelId)/posts\(queryParams)")!
        
        return request(url, withMethod: "GET", withServerUrl: serverUrl, completionHandler: completionHandler)
    }
}
